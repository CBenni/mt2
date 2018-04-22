# ModCh.at
View and moderate multiple twitch.tv channels at the same time

ModCh.at is the newest in moderation tech - a complete twitch viewing, chatting and moderation experience in one compact package, no download required.

It was built to replace "legacy twitch chat", which, in combination with FFZ and multitwitch-style websites used to be the premier way for moderators to manage their chats. Since twitch decided to disable legacy chat over the next couple of days (according to twitch, on 2018/4/20), I am releasing the beta for everyone to enjoy!

It features a completely custom chat, tons of moderation features and the ability to watch any number of channels as well as never before seen configurability.

## Usage
If you want to use [ModCh.at](https://modch.at), simply go to that URL and... thats it!

## Contributing
If you find errors, bugs or other problems or have an idea or suggestion, please open an issue on the repository!

If you want to help out with features and the like, clone the repository, make sure you have yarn installed and run 

    yarn install
    
Then create a config.prod.json and a config.dev.json with the following:

    {
      "auth": {
        "client_id": "juyvdc7nz2wxxavwkjb1fj8g0eg2nj",
        "redirect_uri": "http://localhost:8080"
      }
    }
    
(you can change the client id and redirect uri to your own app, but this isnt necessary in most cases)
    
To build and run the development environment, run

    yarn dev
    
I would like to ask you not to host your own version of this, but to give back to this tool by submitting a pull request.
