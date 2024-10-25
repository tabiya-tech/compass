##!/bin/bash
#
## Check if environment argument is provided
#if [ "$#" -ne 1 ]; then
#  echo "Usage: $0 <environment>"
#  exit 1
#fi
#
#environment=$1 # The environment to deploy to
#
#if [ -z "${environment+x}" ] || [ -z "$environment" ]; then
#  echo "environment is not set, empty, or null."
#  exit 1
#fi
#
#echo "Using Environment: $environment"
#
## from environment split the realm and the environment name
#IFS='.' read -r -a environment_patrs <<< "$environment"
#
#realm_name="${environment_patrs[0]}"
#if [ -z "${realm_name+x}" ] || [ -z "$realm_name" ]; then
#  echo "realm_name is not set, empty, or null."
#  exit 1
#fi
#
#echo "Using realm name: $realm_name"
#
#environment_name="${environment_patrs[1]}"
#if [ -z "${environment_name+x}" ] || [ -z "$environment_name" ]; then
#  echo "environment_name is not set, empty, or null."
#  exit 1
#fi
#
#echo "Using environment name: $environment_name"
#
## Construct the domain name
#domain_name="${environment_name}.${realm_name}.tabiya.tech"
#
## Define the target domain name and URLs
#frontend_url="https://${domain_name}"
#backend_url="https://${domain_name}/api"
## Added in case the backend and frontend domains diverge in the future
#frontend_domain="$domain_name"
#backend_domain="$domain_name"
#
#
## Write the domain names and URLs to the output environment
#echo "frontend_url=${frontend_url}" >> "$GITHUB_OUTPUT"
#echo "backend_url=${backend_url}" >> "$GITHUB_OUTPUT"
#echo "frontend_domain=${frontend_domain}" >> "$GITHUB_OUTPUT"
#echo "backend_domain=${backend_domain}" >> "$GITHUB_OUTPUT"
#echo "domain_name=${domain_name}" >> "$GITHUB_OUTPUT"
#echo "realm-name=${realm_name}" >> "$GITHUB_OUTPUT"
