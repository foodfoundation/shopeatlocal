FROM flyway/flyway
WORKDIR /flyway/sql

COPY app/Extra/*.sql .

ENTRYPOINT flyway -url=jdbc:mysql://${MYSQL_HOST}/shopeatlocal?allowPublicKeyRetrieval=true -user=${MYSQL_USER} -password=${MYSQL_PASSWORD} -connectRetries=60 migrate
