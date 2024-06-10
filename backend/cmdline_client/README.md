This is a command line client to interact with the backend.
It's almost like curl (it uses curl), but it handles whitespaces in user input nicely.

### This is what it does
It assumes the development server for the backend is running on port 8081.
It shows you a prompt where you can chat with the Compass agent.
It forwards your message to the server, gets the reply and show it you you.

### FAQ
Which backend endpoint does it use?
`/conversation_sandbox`

What's the full URL
For example:
`curl http://0.0.0.0:8081/conversation_sandbox?user_input=Hi&only_reply=True`


