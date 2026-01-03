docker stop pure_live_server
docker rm pure_live_server
docker build -t pure_live_server . 2>&1
docker run -d -p 9080:9080 -v ./web_data:/app/data -e HTTP_PROXY="" -e HTTPS_PROXY="" --name pure_live_server pure_live_server
docker logs pure_live_server