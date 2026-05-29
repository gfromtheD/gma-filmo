export interface ServiceError {
  readonly code: string;
  readonly message: string;
}

export interface ServiceResult<TData> {
  readonly data: TData | null;
  readonly error: ServiceError | null;
}

export interface HealthResponse {
  readonly service: string;
  readonly status: string;
  readonly message: string;
  readonly checkedAt: string;
}
