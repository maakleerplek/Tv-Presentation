FROM nginx:alpine

# Generate a self-signed TLS certificate valid for 10 years
RUN apk add --no-cache openssl && \
    mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/self.key \
      -out /etc/nginx/ssl/self.crt \
      -subj "/C=BE/ST=Brabant/L=Leuven/O=Maakleerplek/CN=tv-presentation" \
      -addext "subjectAltName=IP:10.72.3.141"

COPY nginx.conf /etc/nginx/nginx.conf
