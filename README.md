# 0shared

**0shared** is a serverless file-sharing platform deployed directly to AWS.

---

## Architecture Overview

The system uses a serverless architecture for storage, routing, and backend processing.

### 1. Frontend Hosting (S3 & CloudFront)
The frontend is a static website.
* **Frontend S3 Bucket** (`luidsonl-0shared-front`): Hosts static assets. Direct public access is blocked.
* **CloudFront Distribution**: Acts as a CDN to cache and serve the frontend application.
* **Security (OAC)**: Communication between CloudFront and the S3 bucket is secured using **Origin Access Control (OAC)**.

### 2. User File Storage (S3)
* **Files S3 Bucket** (`luidsonl-0shared-files`): Main storage for user files. Direct public access is blocked.
* **Direct Uploads via Pre-signed URLs**: The bucket supports direct browser-to-S3 uploads via CORS policies (`PUT`, `POST`, `GET`, `HEAD`). The backend will generate Pre-signed URLs to authorize client uploads.

### 3. Database (DynamoDB)
The application uses Amazon DynamoDB with a **Single-Table Design** provisioned as `PAY_PER_REQUEST`.
* **Table**: `0shared_data`
* **Attributes**: `PK` (Partition Key), `SK` (Sort Key), and `upload_date`.
* **Secondary Indexes**:
  * **Global Secondary Index (GSI1)**: Keys `GSI1PK` and `GSI1SK` for inverse lookups (e.g., querying all files for a user).
  * **Local Secondary Index (LSI_UploadDate)**: Uses `upload_date` as the range key for chronological sorting and querying.

### 4. Backend & API (Planned: API Gateway & AWS Lambda)
The backend will be implemented using Python and `boto3`.
* **Amazon API Gateway**: Routes HTTP/REST requests to Lambda functions.
* **AWS Lambda**:
  * **Upload Handler**: Validates requests, creates a DynamoDB record, and returns an S3 Pre-signed URL.
  * **List/Query Handler**: Fetches user files by querying DynamoDB.
  * **Download Handler**: Validates permissions and generates S3 Pre-signed GET URLs.

---

## Environments

### AWS

The Terraform infrastructure (`infra/aws`) provisions all resources directly in AWS.
Ministack/LocalStack is no longer used for development due to infrastructure
limitations — even though Ministack is excellent for studying purposes.

#### 1. Bootstrap (State Backend)

Creates the S3 bucket and DynamoDB table for Terraform state management.
Run this once per AWS account.

```bash
cd infra/aws-bootstrap
terraform init
terraform apply
```

#### 2. Deploy Main Infrastructure

```bash
cd infra/aws
terraform init
terraform apply
```

### Ministack (Study Only)

The old LocalStack-based setup lives in `infra/ministack`. Not recommended for
active development — kept for reference.
