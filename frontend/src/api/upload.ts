import {
  abortMultipartUpload,
  multipartComplete,
  multipartInitiate,
  simpleUpload,
} from "./endpoints";

const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100 MB — use multipart above this
const MULTIPART_UPLOAD_MAX = 50 * 1024 * 1024 * 1024; // 50 GB
const MIN_PART_SIZE = 5 * 1024 * 1024; // 5 MB minimum S3 part size
const MAX_PARTS = 10000; // S3 multipart part limit

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export type UploadStatus = "preparing" | "uploading";

export interface UploadOptions {
  onStatus?: (status: UploadStatus) => void;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}

function abortError(): DOMException {
  return new DOMException("The upload was aborted", "AbortError");
}

function putBlob(
  url: string,
  blob: Blob,
  options: { contentType?: string; signal?: AbortSignal; onProgress?: (p: UploadProgress) => void },
): Promise<string | void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (options.contentType) xhr.setRequestHeader("Content-Type", options.contentType);

    let onAbort: (() => void) | undefined;
    if (options.signal) {
      if (options.signal.aborted) {
        reject(abortError());
        return;
      }
      onAbort = () => xhr.abort();
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    const cleanup = () => {
      if (onAbort && options.signal) options.signal.removeEventListener("abort", onAbort);
    };

    if (options.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          options.onProgress!({
            loaded: event.loaded,
            total: event.total,
            percent: Math.round((event.loaded / event.total) * 100),
          });
        }
      };
    }

    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.getResponseHeader("ETag") ?? undefined);
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error("Upload failed (network error)"));
    };
    xhr.onabort = () => {
      cleanup();
      reject(abortError());
    };

    xhr.send(blob);
  });
}

export async function uploadFileToStorage(file: File, options: UploadOptions = {}): Promise<void> {
  const { onStatus, onProgress, signal } = options;
  const contentType = file.type || "application/octet-stream";

  if (file.size > MULTIPART_UPLOAD_MAX) {
    throw new Error("File exceeds the maximum upload size of 50 GB");
  }
  if (file.size === 0) {
    throw new Error("Cannot upload an empty file");
  }

  onStatus?.("preparing");

  if (file.size <= MULTIPART_THRESHOLD) {
    const res = await simpleUpload({ filename: file.name, contentType });
    onStatus?.("uploading");
    await putBlob(res.url, file, {
      contentType,
      signal,
      onProgress,
    });
    return;
  }

  const partSize = Math.max(MIN_PART_SIZE, Math.ceil(file.size / MAX_PARTS));
  const initiated = await multipartInitiate({
    filename: file.name,
    contentType,
    fileSize: file.size,
    partSize,
  });

  const { uploadId, key, parts } = initiated;
  try {
    onStatus?.("uploading");
    let bytesDone = 0;
    const uploadedParts: { partNumber: number; ETag: string }[] = [];
    for (const part of parts) {
      if (signal?.aborted) throw abortError();
      const slice = file.slice(part.start, part.end + 1);
      const etag = await putBlob(part.url, slice, {
        contentType: "application/octet-stream",
        signal,
        onProgress: (p) =>
          onProgress?.({
            loaded: bytesDone + p.loaded,
            total: file.size,
            percent: Math.round(((bytesDone + p.loaded) / file.size) * 100),
          }),
      });
      if (etag) uploadedParts.push({ partNumber: part.partNumber, ETag: etag });
      bytesDone += slice.size;
    }
    await multipartComplete({ uploadId, key, parts: uploadedParts });
  } catch (err) {
    try {
      await abortMultipartUpload({ uploadId, key });
    } catch {
      // best-effort cleanup; ignore failures
    }
    throw err;
  }
}
