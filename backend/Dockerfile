FROM python:3.11-slim

WORKDIR /app

# Install Python deps
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy backend code
COPY . /app/backend

# Expose FastAPI port
EXPOSE 8000

# Run FastAPI server
ENV PYTHONPATH=/app
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
