#!/bin/bash

SERVER_PORT=8080

echo "This client sends messages to http://0.0.0.0:$SERVER_PORT"
echo "If you have not yet done so, start the server first."
echo " "


while [ -n $STOP ]
do
  echo -n "You: "
  read USER_INPUT
  echo -n -e "\033[1mAgent: "
  curl http://0.0.0.0:$SERVER_PORT/conversation_sandbox?user_input="${USER_INPUT//' '/'%20'}&only_reply=True"
  echo -e "\033[0m"
done

echo "Done. You can stop the server now"

