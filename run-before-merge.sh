#!/bin/bash
NC='\033[0m' # No Color

function activateBackendVenv() {
    deactivateBackendVenv
    source venv-backend/bin/activate
    checkActivatedVenv
}
function deactivateBackendVenv() {
    if which deactivate >/dev/null; then
        deactivate
    fi
}
function checkActivatedVenv() {
    if [ -n "$VIRTUAL_ENV" ]; then
        echo "Virtual environment activated: $VIRTUAL_ENV"
    else
        printError "No virtual environment activated."
        exit 1
    fi
}

function backend() {
  local project="backend"
    printTitle ${project}
  (cd backend/ && activateBackendVenv &&  poetry lock --no-update --no-interaction; poetry install --sync --no-interaction && poetry run bandit -c bandit.yaml -r . && poetry run pylint --exit-zero app esco_search evaluation_tests; poetry run pytest -k "not smoke_test";deactivateBackendVenv)
   # if the previous command fails, exit this script with a non-zero error code
  if [ $? -ne 0 ]; then
    printError ${project}
    exit 1
  fi
  printSuccess ${project}
}

function printTitle() {
  local blue='\033[1;30;44m'
  local title="Begin to build the ${1}"
  printf "${blue}$(getSpaces "${title}")${NC}\n"
  printf "${blue}${title}${NC}\n"
  printf "${blue}$(getSpaces "${title}")${NC}\n"
}
function getSpaces() {
  local length=${#1}
  echo "%${length}s"
}

function printSuccess() {
  local green='\033[1;32;42m'
  local txt="Building the ${1} succeeded!"
  printf "${green}$(getSpaces "${txt}")${NC}\n"
  printf "${green}${txt}${NC}\n"
  printf "${green}$(getSpaces "${txt}")${NC}\n"
}

function printError() {
  local red='\033[1;31;41m'
  local txt="Building the ${1} failed!"
  printf "${red}$(getSpaces "${txt}")${NC}\n"
  printf "${red}${txt}${NC}\n"
  printf "${red}$(getSpaces "${txt}")${NC}\n"
}

function printFormatError() {
  local orange='\033[1;33;43m'
  local txt="Formatting errors detected for ${1}! Run prettier --write to fix them."
  printf "${orange}$(getSpaces "${txt}")${NC}\n"
  printf "${orange}${txt}${NC}\n"
  printf "${orange}$(getSpaces "${txt}")${NC}\n"
}

PS3="Select what you want to build and test: "

OPTIONS="All Backend"
select opt in $OPTIONS; do
  if [ "$REPLY" = "1" ]; then
      echo "******************" &&
      echo "Building all" &&
      echo "******************" &&
      backend
      exit $?
  elif [ "$REPLY" = "2" ]; then
    backend
    exit $?
  else
    clear
    echo bad option
  fi
done
