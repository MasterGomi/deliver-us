// Code to use the Google Maps API as a custom element

//import regeneratorRuntime from "regenerator-runtime";

var attrRef;
var curMarkerTitle;

// Hex code please
const pathColour = "#4BB0DC";
const pathOpacity = 1.0;
// Pixels (at any given zoom level)
const pathWidth = 2;
// Object defining if/how each map element is drawn. This lets us have an   a e s t h e t i c   map
const mapStyling = [
    {
        "featureType": "landscape",
        "elementType": "geometry",
        "stylers": [
            {"color": "#f0f0f0"},
        ]
    },
    {
        "featureType": "landscape.natural",
        "elementType": "labels",
        "stylers": [
            {"color": "#bbbbbb"},
        ]
    },
    {
        "featureType": "poi",
        "stylers": [
            {"visibility": "off"},
        ]
    },
    {
        "featureType": "road",
        "elementType": "geometry",
        "stylers": [
            {"visibility": "simplified"},
            {"color": "#dddddd"},
        ]
    },
    {
        "featureType": "road",
        "elementType": "labels.icon",
        "stylers": [
            {"visibility": "off"},
        ]
    },
    {
        "featureType": "road",
        "elementType": "labels.text.fill",
        "stylers": [
            {"visibility": "on"},
            {"color": "#444444"},
        ]
    },
    {
        "featureType": "transit",
        "stylers": [
            {"visibility": "off"},
        ]
    },
    {
        "featureType": "water",
        "elementType": "geometry",
        "stylers": [
            {"visibility": "simplified"},
            {"color": "#FFFFFF"}
        ]
    },
    {
        "featureType": "water",
        "elementType": "labels",
        "stylers": [
            {"visibility": "off"},
        ]
    },
];


// A slightly hacky function for stalling the JS execution for a bit. Used to wait for Corvid's query
function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Get an array of all active pick-up locations as Google Maps markers
// Note: in current implementation, this will return an empty array if the query fails
async function getAllMarkers() {
    var markers = [];
    // Make sure Corvid has finished our request
    while(attrRef.getAttribute("pickups") === null){
        console.log("Waiting for pickups to be set");
        await sleep(2000);
    }
    var pickupPoints = attrRef.getAttribute("pickups");
    var points = JSON.parse(pickupPoints);
    if ("items" in points){
        for(var i = 0; i < points.items.length; i++){
            markers.push(toMarkerObj(points.items[i]));
        }
    }
    else {/*query has errored. Probably wait a while then dispatch event again?*/}
    return markers;
}

// Set up onClick events for each of the markers on the map
function setUpAllCheckEvents(markers){
    markers.forEach((marker) => {
        marker.addListener("click", () => {
            curMarkerTitle = marker.getTitle();
            doThisOne();
        });
    });
}

// Send an event outside of the custom element to the page JS code with the details of the location selected
// This lets us work with the Corvid elements and other features we don't have access to here
function doThisOne(){
    navigator.geolocation.getCurrentPosition((loc) => {
        let locForSend = translateLocationToStandardObject(loc);
        attrRef.dispatchEvent(new CustomEvent('do-this-one', {detail: {title: curMarkerTitle, locationObj: locForSend}}));
    }, (error) => {
        console.log(JSON.stringify(error));
        attrRef.dispatchEvent(new CustomEvent('do-this-one', {detail: {title: curMarkerTitle, locationObj: null}}));
    }, {timeout: 5000});
}

// Construct a new (trimmed) object out of the Google Maps-provided location object with only the details we need
// This is done to maximise the amount of data we can send and request between the custom element, page code, and Corvid databases
function translateLocationToStandardObject(position){
    var positionObject = {};
    if ('coords' in position) {
        positionObject.coords = {};

        if ('latitude' in position.coords) {
            positionObject.coords.latitude = position.coords.latitude;
        }
        if ('longitude' in position.coords) {
            positionObject.coords.longitude = position.coords.longitude;
        }
        if ('accuracy' in position.coords) {
            positionObject.coords.accuracy = position.coords.accuracy;
        }
        if ('altitude' in position.coords) {
            positionObject.coords.altitude = position.coords.altitude;
        }
        if ('altitudeAccuracy' in position.coords) {
            positionObject.coords.altitudeAccuracy = position.coords.altitudeAccuracy;
        }
        if ('heading' in position.coords) {
            positionObject.coords.heading = position.coords.heading;
        }
        if ('speed' in position.coords) {
            positionObject.coords.speed = position.coords.speed;
        }
    }
    return positionObject
}

// Establish events to send user to Google/Apple maps with directions to the selected marker
function setUpDirectionEvents(markers){
    markers.forEach((marker) => {
        marker.addListener("click", () =>{
            giveDirections(marker.getPosition());
        })
    })
}

// Draw the lines connecting the delivery markers to show how the packages have travelled
async function drawLines(map){
    // Make sure Corvid has finished our request
    while(attrRef.getAttribute("paths") === null){
        console.log("Waiting for paths to be set");
        await sleep(2000);
    }
    var paths = JSON.parse(attrRef.getAttribute("paths"));
    if(paths.length > 0){
        for(var i = 0; i < paths.length; i++){
            let curPath = paths[i];
            // We don't need to worry about drawing one point paths
            if(curPath.length > 1){
                // Create the line, as represented by curPath
                const newLine = new google.maps.Polyline({
                    "path": curPath,
                    "strokeColor": pathColour,
                    "strokeOpacity": pathOpacity,
                    "strokeWeight": pathWidth
                });
                // Place it on the map
                newLine.setMap(map);
            }
        }
    }
    else {/*query failed*/}
}

// This is the maps callback method. This will be called when the Google Maps API call succeeds and is ready.
// When this is called, we are guarenteed to have access to the Maps API
async function initMap() {
    console.log("initMap called!");
    // Make the map
    var map = new google.maps.Map(document.getElementById('map'), {
        // This lat long coord is the center of Melbourne
        center: { lat: -37.815338, lng: 144.963226 },
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
        styles: mapStyling,
    });
    // Get marker objects for every entry in the Active Pick-up Points database
    var markers = await getAllMarkers();
    // Set each marker to be on the map we just defined
    markers.forEach((marker) => {
        marker.setMap(map);
    });
    if(attrRef.getAttribute("game-over") !== "true"){
        // If we're on the pick-up page, set up the info windows to show the ref code
        if(attrRef.getAttribute("pick-up") === "true") setUpAllCheckEvents(markers);
        // Otherwise (home page) set it to give directions on click
        else setUpDirectionEvents(markers);
    }
    drawLines(map);
}

// The following establishes the core functionality of the custom element.
// After everything is good and loaded, initMap() will be called, the map API will be accessible within that method
class MapsElement extends HTMLElement {
    async connectedCallback() {
        var isSafari = navigator.vendor && navigator.vendor.indexOf('Apple') > -1 &&
               navigator.userAgent &&
               navigator.userAgent.indexOf('CriOS') == -1 &&
               navigator.userAgent.indexOf('FxiOS') == -1;
        if (isSafari) window.alert("Unfortunately, we have noticed issues with Deliver Us in Safari browsers.\nIf you run into issues while trying to use our site, please consider trying it in Chrome or Firefox.");
        // Define the area we will display the map to
        this.innerHTML = '<div id="map"><p>Hang tight! We\'re loading the map</p></div>';
        // Set the height and width
        var styleSheet = document.createElement('style');
        var width = isMobileBrowser() ? `100vw` : this.getAttribute("width");
        var height = isMobileBrowser() ? this.getAttribute("mobile-height") : this.getAttribute("height");
        styleSheet.innerHTML = `
            maps-element {
                height: 100%;
                width: 100%;
                background-color: blue;
            }
            #map{
                height: ` + height + `;
                width: ` + width + `;
            }
        `;
        this.appendChild(styleSheet);
        // Tell corvid to query the database for the active pick-up points and delivery paths (see the page code)
        // Or don't cause I optimised the hell out of it
        //this.dispatchEvent(new CustomEvent('get-pickups'));
        attrRef = this;
        // Set up the API call
        var mapScript = document.createElement('script');
        mapScript.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyCW2qHEqx6oJfI5UpM75sjWQYGQcu5M0-M&callback=initMap';
        mapScript.defer = true;
        // Set up the callback method (see 'callback=' in script src above)
        window.initMap = initMap;
        // Add the script tag to the page
        document.head.appendChild(mapScript);
    }
}
customElements.define('maps-element', MapsElement);

// Takes a geolocation object (returned from retrieving the user's location) and creates a lat/lng object to use for the Google Maps API
function toLatLng(obj /*geolocation object*/ ) {
    return {
        'lat': obj.coords.latitude,
        'lng': obj.coords.longitude,
    }
}

// Creates a Google Maps Marker object from an entry in the Active Pick-up Points database
function toMarkerObj(obj /*Active Pick-up Points database entry object*/ ) {
    var markerSettings = {
        'position': toLatLng(obj.knot.destination),
        'title': obj.title,
        'icon': {'url': "https://i.imgur.com/SttZwjf.png"}
    }
    return new google.maps.Marker(markerSettings);
}

function isMobileBrowser(){
    let check = false;
    // Just bear with it. It comprehensively (perhaps too comprehensively) checks for indications of a mobile browser
    // Thanks StackOverflow
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
    return check;
}

// Sends user to Google Maps or their map app on mobile with directions to the selected point
function giveDirections(longLat) {
    // If IOS, give special apple link
    if ((navigator.platform.indexOf("iPhone") != -1) || 
        (navigator.platform.indexOf("iPad") != -1) || 
        (navigator.platform.indexOf("iPod") != -1))
            window.open("maps://maps.google.com/maps?daddr=" + longLat.toUrlValue() + "&amp;ll=");
    // Else give a web link (works in desktop, redirects to map app on android)
    else window.open("https://maps.google.com/maps?daddr=" + longLat.toUrlValue() + "&amp;ll=");
}