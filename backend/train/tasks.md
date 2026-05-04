# Training Backend Tasks

## Dataset Upload And Import

- [x] Add ZIP dataset upload endpoint: `POST /api/train/pipelines/{id}/items/upload-zip/`.
- [x] Support ZIP layout:
  - `images/*.jpg|jpeg|png`
  - `labels/*.txt`
- [x] Match images and labels by filename stem.
- [x] Reject unsafe ZIP paths such as absolute paths or `../`.
- [x] Extract uploaded ZIP to a temporary import directory.
- [x] Create `TrainingDatasetItem` records from extracted files.
- [x] Keep current multi-file upload endpoint for small batches.
- [ ] Add dataset import status model if ZIP imports become slow:
  - `pending`
  - `running`
  - `completed`
  - `failed`
- [ ] Move large ZIP import work to a background command/job if request time becomes too long.

## Dataset Validation

- [ ] Validate YOLO label format per line.
- [ ] Validate class indexes against `TrainingDatasetClass`.
- [ ] Store validation errors on `TrainingDatasetItem.validation_errors`.
- [ ] Add API response summary for upload/import:
  - total images
  - matched labels
  - missing labels
  - invalid labels
- [ ] Add endpoint to re-run validation for a pipeline.

## Split Handling

- [ ] Ensure split percentages must total `100`.
- [ ] Add API guard that training cannot start while items are `unassigned`.
- [ ] Add API guard that training cannot start when there are no `train` or `val` items.
- [ ] Preserve deterministic split behavior through `seed`.

## Training Queue

- [x] Create management command to consume pending training jobs.
- [x] Lock one pending job at a time using `status`, `locked_at`, and `worker_id`.
- [x] Generate YOLO dataset directory and `data.yaml`.
- [x] Run Ultralytics training with `TrainingConfig.final_args`.
- [x] Update `TrainingJob.status`:
  - `pending`
  - `running`
  - `completed`
  - `failed`
  - `cancelled`
- [x] Update `current_epoch`, `total_epochs`, and `progress_percent`.
- [x] Capture error output into `TrainingJob.error_message`.

## Metrics And Artifacts

- [x] Parse epoch metrics into `TrainingEpochMetric`.
- [x] Save model artifacts into `TrainingArtifact`:
  - best model
  - last modeldo we have a way to store files in s3 compatable object storage
  - results
  - confusion matrix
  - logs
- [ ] Add artifact download API if direct media URLs are not enough.

## API Hardening

- [ ] Add serializers/tests for every training endpoint.
- [ ] Add permissions for training pipeline access if project-level assignment is introduced.
- [ ] Add pagination for dataset item lists.
- [ ] Add delete safeguards for pipelines with running jobs.
- [ ] Add cancellation endpoint for queued/running jobs.
- [ ] Add retry endpoint for failed jobs.


[ ] clean up after trainig
