from fastapi import FastAPI

app = FastAPI(
    title="REVV API",
    description="Automotive Marketplace & Intelligence Platform",
    version="1.0.0"
)

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "REVV API",
        "version": "1.0.0"
    }
