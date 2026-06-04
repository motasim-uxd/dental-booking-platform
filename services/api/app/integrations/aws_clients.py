from __future__ import annotations

import os
from functools import lru_cache
from typing import Any


def _region() -> str:
  return (os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1").strip()


@lru_cache(maxsize=1)
def bedrock_runtime() -> Any | None:
  try:
    import boto3

    return boto3.client("bedrock-runtime", region_name=_region())
  except Exception:
    return None


@lru_cache(maxsize=1)
def sqs_client() -> Any | None:
  try:
    import boto3

    return boto3.client("sqs", region_name=_region())
  except Exception:
    return None


@lru_cache(maxsize=1)
def dynamodb_resource() -> Any | None:
  try:
    import boto3

    return boto3.resource("dynamodb", region_name=_region())
  except Exception:
    return None
