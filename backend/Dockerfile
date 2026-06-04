FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Railway задаёт PORT, не хардкодим
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD python -c "import http.client, os; p=os.getenv('PORT','8000'); http.client.HTTPConnection('localhost',p).request('GET','/health'); r=http.client.HTTPConnection('localhost',p).getresponse(); exit(0 if r.status==200 else 1)"

CMD ["python", "run.py"]
