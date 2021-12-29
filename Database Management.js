// An auxiliary hidden page for manipulating the database for testing or seeding purposes

import wixData from 'wix-data';
import wixWindow from 'wix-window';
import Geocode from 'react-geocode';

// HTML tags
const codenameField = "#codenameField";
const locationField = "#locationField";
const knotField = "#knotID";


export async function startPickup(){
    var codename = $w(codenameField).value;
    // Note: expecting contents of the knot field to be a knot id
	console.log($w(knotField).value)
    var knot = await wixData.query("Knots")
		.eq("_id", $w(knotField).value)
		.find()
		.then((obj) => {return obj.items[0]});
    console.log("Returned knot: " + JSON.stringify(knot));

    // Then submit
    var newDelivery = {
        "codename": codename,
		"origin": knot._id,
    }
    wixData.insert("Deliveries", newDelivery).then((obj) => {console.log("Success!")}, () => {console.log("Failure!")});
}

export async function startDropoff(){
    var codename = $w(codenameField).value;
    var locationText = $w(locationField).value;
    var locationObj;
    if (locationText === "") {
        locationObj = await wixWindow.getCurrentGeolocation();
    }
    else {
        var coordsRe = RegExp(escapeRegExp("\d+(.\d+)?, \d+(.\d+)?"));
        if (coordsRe.test(locationText)){
            // Passed were coords
            var coords = locationText.split(",");
            if(coords.includes(" ")) coords = coords.split(" ");
            locationObj = {
                "coords": {
                    "latitude": parseFloat(coords[0]),
                    "longitude": parseFloat(coords[1]),
                    "accuracy": 1,
                }
            }
        }
        else{
            // Passed was an address
            var latLng = parseToLatLng(locationText);
            locationObj = {
                "coords": {
                    "latitude": latLng.lat,
                    "longitude": latLng.lng,
                    "accuracy": 1,
                }
            }
        }
    }

    // Get the in-propgress delivery
    var deliveryObj = await wixData.query("Deliveries")
        .include("origin")
        .eq("codename", codename)
        .find()
        .then((obj) => {return obj.items[0]});
    var deliveredKnot = deliveryObj.origin;
	console.log("deliveryObj: " + JSON.stringify(deliveryObj));
	console.log("deliveredKnot: " + JSON.stringify(deliveredKnot));

    // Submit the delivery
    var submission = {
        "source": deliveredKnot,
        "destination": locationObj,
        "isOrigin": false,
		"title": codename + Math.floor(Math.random() * 10000),
        "artifical": true,
    }
    wixData.insert("Knots", submission).then(() => {console.log("Successful delivery!")}, (error) => {console.log("Error: " + error)});
}

$w.onReady(function () {
	// Set up geocode
    Geocode.setApiKey('AIzaSyDaUDvosIORr8vGxQFbkAEPDa99IywSYFw');
    Geocode.setRegion('AU');
});

export async function bulkAdd_click(event) {
    var bulkAddButton = $w('#button3');
    bulkAddButton.disable();
    bulkAddButton.label = "Working...";
    $w('#done').collapse();
	var fullEntry = $w('#bulkAddField').value;
    // Specified seperator is ' / ' (space-slash-space)
    var entries = fullEntry.split(' / ');
    var toAdd = [];
    for (var i = 0; i < entries.length; i++){
        let latLng = await parseToLatLng(entries[i]);
        toAdd.push(constructKnotObjFromLatLng(latLng, entries[i]));
    }
    await wixData.bulkInsert("Knots", toAdd);
    bulkAddButton.enable();
    bulkAddButton.label = "Bulk add";
    $w('#done').expand();
}

async function parseToLatLng(address){
    return await Geocode.fromAddress(address).then((response) => {
        return response.results[0].geometry.location;
    })
}

function constructKnotObjFromLatLng(latLngObj, title){
    return {
        "title": title,
        // no source
        "destination": {
            "coords": {
                "latitude": latLngObj.lat,
                "longitude": latLngObj.lng,
                "accuracy": 1,
            },
        },
        "isOrigin": true,
        "artificial": true,
    }
}

function escapeRegExp(string) {
    return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export async function chainButton_click(event) {
    $w('#chainButton').disable();
    $w('#chainDone').collapse();
	var knotDataset = $w('#dataset1');
    var fullChainText = $w('#chainField').value;
    var links = fullChainText.split(' / ');
    var submittedIds = {};
    var first = true;
    for (var i = 0; i < links.length; i++){
        let link = links[i];
        var closeBracketIndex = link.indexOf(')');
        var splitIdRe = new RegExp(/(?<=\()\d+(.\d+)*(?=\))/);
        var splitId = link.match(splitIdRe);
        splitId = splitId[0];
        var address = link.substring(closeBracketIndex + 2);
        var idRe = new RegExp(/[a-zA-Z0-9]+(-[a-zA-Z0-9]+){4}/);
        if(idRe.test(address)){
            submittedIds[splitId] = address;
            first = false;
            continue;
        }
        var coordRe = new RegExp(/\d+(.\d+)?, \d+(.\d+)?/);
        var latLng
        if(coordRe.test(address)){
            var coords = address.split(", ");
            latLng = {
                "lat": parseFloat(coords[0]),
                "lng": parseFloat(coords[1]),
            }
        }
        else latLng = await parseToLatLng(address);
        var toSubmit = {
            "title": address,
            "destination": {
                "coords": {
                    "latitude": latLng.lat,
                    "longitude": latLng.lng,
                    "accuracy": 1,
                },
            },
            "artificial": true,
        }
        if(first){
            toSubmit.isOrigin = true;
            await knotDataset.new().then(() => {
                knotDataset.setFieldValues(toSubmit);
            });
            first = false;
        }
        else{
            toSubmit.isOrigin = false;
            if(splitId.includes('.')){
                var lastPeriodIndex = splitId.lastIndexOf('.');
                var lastPart = parseInt(splitId.substring(lastPeriodIndex + 1), 10);
                var firstPart = splitId.substring(0, lastPeriodIndex);
                if(lastPart > 1){
                    toSubmit.source = submittedIds[firstPart + "." + (lastPart - 1).toString()];
                } 
                else{
                    toSubmit.source = submittedIds[firstPart];
                }
            }
            else{
                toSubmit.source = submittedIds[(parseInt(splitId, 10) - 1).toString()];
            }
            await knotDataset.new().then(() => {
                knotDataset.setFieldValues(toSubmit);
            });
        }
        submittedIds[splitId] = knotDataset.getCurrentItem()._id;
    }
    knotDataset.save()
    $w('#chainButton').enable();
    $w('#chainDone').expand();
}