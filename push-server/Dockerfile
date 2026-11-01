FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
# tanpa dependensi luar: tidak perlu npm install
COPY package.json ./
<<<<<<< HEAD
COPY server.js ./
=======
>>>>>>> b131f11426a8e56bd4894ea31a637dd69b90539d
COPY src ./src
COPY public ./public
COPY scripts ./scripts
RUN mkdir -p /app/data && chown -R node:node /app
USER node
ENV DB_PATH=/app/data/push.db PORT=8080
EXPOSE 8080
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
<<<<<<< HEAD
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
=======
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
>>>>>>> b131f11426a8e56bd4894ea31a637dd69b90539d
