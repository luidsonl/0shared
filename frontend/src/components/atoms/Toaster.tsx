import { Toaster as SonnerToaster } from "sonner";

export default function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      theme="dark"
      toastOptions={{
        className:
          "!rounded-none !border !border-border !bg-background !font-mono !text-foreground",
      }}
    />
  );
}
