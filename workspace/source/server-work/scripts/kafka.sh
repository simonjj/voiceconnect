#!/bin/bash

# shellcheck source=/dev/null
. /opt/bitnami/scripts/libkafka.sh

KAFKA_ADVERTISED_LISTENERS="PLAINTEXT://$(hostname -i):9092"
kafka_server_conf_set advertised.listeners "${KAFKA_ADVERTISED_LISTENERS}"
