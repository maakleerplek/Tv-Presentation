#!/bin/sh

# Generate self-signed SSL cert if it doesn't exist
if [ ! -f /etc/nginx/ssl/cert.pem ]; then
    mkdir -p /etc/nginx/ssl
    openssl req -x509 -nodes -days 365 \
        -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/key.pem \
        -out /etc/nginx/ssl/cert.pem \
        -subj "/CN=tv-presentation/O=Local/C=BE"
    echo "SSL certificate generated."
fi

# Substitute env vars in nginx config
envsubst '${HTTPS_PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g "daemon off;"
