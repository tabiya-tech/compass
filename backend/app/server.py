from fastapi import FastAPI
import os

app = FastAPI()


@app.get("/")
async def root():
    return {"Hello Tabiya"}


@app.get("/version")
async def version():
    return {"version": os.getenv("VERSION")}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
