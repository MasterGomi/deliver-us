# Deliver Us
Deliver Us was a web-based pervasive game produced as a group project for Swinburne University of Technology's Pervasive Game Design unit.
This game was live from August to October 2020 and asked players to pick up a virtual package placed in the real-world using Google Maps and geolocation and take it with them while listening to an audio naration that takes them on a small journey though a semi-fictional world.

## General notes
In order to drastically cut down development time, as I was the only one who was competent with web development, the web pages for this game were created with and hoste by Wix, this enabled me to focus solely in writing the actual game's code, rather than writing the websites from scratch.
The trade-off is that working with Wix imposed some weird limitations.
- You might notice some weird syntax and work-arounds on all pages except the [maps element](maps-element.js), this is because Wix sort of has its own JS syntax. Now, I am slightly exaggerating here, but it does have its own libraries that you need to use to access certain features that you would natively have access to in JS (such as the `window` object), while also taking access to a lot of standard JavaScript feature away for some reason.
- As the website was created through Wix, I don't have access to the actual webpages' html and css, only the JavaScript that I directly wrote. This means I can't easily rehost it myself. I am considering rewriting this from scratch at some point to revive it though.
- Because the Google Maps API required a few features of JavaScript that Wix removes access to, [maps-element.js](maps-element.js) was written as a custom HTML element that runs embeded in the page. The maps element, however, needs access to some of the database stuff that I can only access using Corvid (since renamed to something else, not sure what), which I only have access to on the main page code; similarly, the maps element needs to pass information back from the custom element to the main page code. This results in some hacky work-arounds that allow the two scripts to talk to each other that might look odd in the code.

# The webpages

## Home page
![Deliver Us Home Page](home%20page.png?raw=true)
This is the [home page](Home.js)
This page is one of the two that feature the [custom map element](maps-element.js).
This page is pretty simple, as it just has the map element that shows the current state of the game, and a text spiel to introduce the game to the players.

## Pick-up page
[This](Pick-up.js) is the page used by players to begin a delivery.
This is the other page that uses the [custom map element](maps-element.js).
The main thing this page needs to do is to allow players to select a package to pick-up (through the map element), check their location to make sure that they are close enough to pick it up, prompt users for a 'codename' to go by for the delivery (this is functionally a user registration, just without any details or a password), then record that that delivery has been started in the database.

## Drop-off page
[This](Derop-off.js) is the page where players complete their delivery.
This page is perhaps the most overall complex page. Here we must retrieve the in-progress delivery entry from the database based on the players 'codename', show the player a response from another player retrieved from the messages database, record the player's response in the messages database, and confirm the player's delivery.
Additionally, in order to make the game as accessible as possible, this page was written so that players can complete their delivery even if something goes wrong. As such, the code has an alternate submission protocol that is able to maximise player participation even in the face of these errors.

## Databse management page
[This](Database%20Management.js) page was a hidden page to allow us an easy way to add artificial data to the databases. It also contained a particularly complex method that would allow multiple points to be added to the database simultaneously and as part of a line.

## Request page
[This](Request.js) page was a very simple page that allowed players to request a location for a package to be sent nearby to, as well as an email address to send them a notification when there's a package nearby.
