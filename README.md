---
title: Spatial3D
emoji: 🖥️
colorFrom: indigo
colorTo: blue
sdk: gradio
sdk_version: 5.34.2
app_file: app.py
pinned: false
license: mit
short_description: High-fidelity 3D Scene Generation from single image
---

Quick Start: the online demo https://huggingface.co/docs/hub/spaces-config-reference (If it is expired, please run locally following the instructions below)

Run the demo locally, you need to have docker installed with GPU support and at least 16GB GPU memory (If not available, please consider contact me cfangac@connect.ust.hk).: 
1. Build docker image: 
```bash
docker build -t fangchuan/comp5411_group3:latest .
```
2. Run the docker container:
```bash
docker run -it -d  --gpus all --shm-size="128g" --privileged=true -p 9001:9001 fangchuan/comp5411_group3:latest /bin/bash
```
it will run the container in the background, you can get the container id by `docker ps`
3. Exec into the container:
```bash
docker exec -it <container_id> /bin/bash
```
4. Run thhe server.py at the codes directory `/app/`:
```bash
python server.py
```
5. Run the app.py at the root directory `/app/`:
```bash
python app.py
```
Then you will get the link to access the demo in the terminal output.