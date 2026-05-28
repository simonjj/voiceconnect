#!/bin/bash
set -f
AWS=$(which aws)
[ -z "${AWS}" ] && exit 1

prepare_server()
{
    if [ -z "${IMAGE}" ]; then
        usage
        exit 1
    fi

    VERSION="${VERSION:=latest}"

    PASSWORD=$(aws ecr get-login-password)
    REGISTRY=$(aws ecr describe-repositories --repository-names "${IMAGE}" | jq --raw-output .repositories[0].repositoryUri)

    # shellcheck disable=SC2206
    read -ra URL -d '/' <<<"${REGISTRY}"
    echo "${URL[0]}"

    # shellcheck disable=SC2091
    echo "${PASSWORD}" | docker login -u AWS --password-stdin "https://${URL[0]}" > /dev/null 2>&1

    docker pull "${REGISTRY}:${VERSION}"
    COMPOSE_IMAGE_VERSION="${REGISTRY}:${VERSION}"
}

start_server()
{
    CMD=$(which docker-compose)
    ENV=${ENV:=production}
    ARG=()
    while IFS= read -r LINE; do
        ARG+=("-f ${LINE}")
    done < <(find . -type f \( -name "docker-compose.${ENV}.yml" ! -name 'docker-compose.override.yml' \))
    COMPOSE="${CMD} -f docker-compose.yml ${ARG[*]} config > stack.production.yml"
    eval "IMAGE=${COMPOSE_IMAGE_VERSION} NODE_PORT=${NODE_PORT:=3000} ${COMPOSE}"
    eval "docker stack deploy --with-registry-auth -c stack.production.yml ${IMAGE//\//-}"
}

usage()
{
    echo "usage: server -i image [-v --image-version=latest]"
}

while [ "${1}" != "" ]; do
    case $1 in
        -i | --image ) shift
            IMAGE=$1
            ;;
        -v | --image-version ) shift
            VERSION=$1
            ;;
        -h | --help ) usage
                      exit
                      ;;
        * )           usage
                      exit 1
    esac
    shift
done

prepare_server
start_server
