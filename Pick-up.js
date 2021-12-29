import wixLocation from 'wix-location';
import wixWindow from 'wix-window';
import wixData from 'wix-data';
import { local } from 'wix-storage';
// LatLonSpherical is used for calculations involving lat long coords, namely distance
import LatLonSpherical from 'public/latlon-spherical.js';

const minRadius = 60;
const afterPickupUrl = "/audio";
const failedSubmissionQuery = "?failed=true";
// These two arrays are used to generate example aliases (usernames) in the simple AdjectiveNoun format
const exampleAliasAdjectives = [
    "Red", "Orange", "Yellow", "Green", "Blue", "Purple", "Brown",
    "Magenta", "Cyan", "Olive", "Maroon", "Navy", "Aquamarine",
    "Turquoise", "Silver", "Lime", "Teal", "Indigo", "Violet", 
    "Pink", "Black", "White", "Gray", "Super", "Giant", "Dire",
    "Dreadful", "Powerful", "Happy", "Cheerful", "Dull", "Dreary",
    "Huge", "Informative", "Desperate", "Energetic", "Popular",
    "Neo", "Futuristic", "Retro", "Spirited", "Dry", "Thoughtful",
    "Forgetful", "Youthful", "Shadow", "Moonlight", "Sun", "Star",
]
const exampleAliasNouns = [
	"Memo", "Letter", "Parcel", "Origin", "Whisper", "Shout",
	"Message", "Note", "Page", "Telegram", "Conversation", "Comms",
    "Postcard", "Envelope", "Chat", "Ship", "Cargo", "Bundle", 
    "Cache", "Container", "Tower", "Transmitter", "Signal", "Cable",
    "Text", 
]

var targetKnot = null;
var userCodename = null;
var userLocationObj = null;
var fullKnots;
var fullPickups;

// Generates and saves a record of the newly undertaken delivery to the Deliveries database.
//  Returns true on succes, false otherwise
async function recordDeliveryInProgress(){
    var record = {
        "codename": userCodename,
        "origin": targetKnot._id
    };
    return await wixData.insert("Deliveries", record).then(() => {return true;}, (results) => {console.log("Submission failed. Here's why: " + JSON.stringify(results)); return false;});
}

async function getUserLocation() {
    return await wixWindow.getCurrentGeolocation().then((obj) => { return obj; }, () => { return null; /*Error handling here (or later during null handling)*/ });
}

function currentLocationIsCloseEnough(){
    // Get LatLongSpherical object representations of each of the two points
    // Note: btw, LatLongSpherical calculations are the quickest but least accurate of the suite offered by
    //      this collection I'm using, but for the incredibly small distances that I'm calculating, the
    //      error margin is entirely inconcequential
    var userLatLong = LatLonSpherical.parse(userLocationObj["coords"]["latitude"], userLocationObj["coords"]["longitude"]);
    var knotLatLong = LatLonSpherical.parse(targetKnot["destination"]["coords"]["latitude"], targetKnot["destination"]["coords"]["longitude"]);
    // Find the distance (in meters) between the two points
    var dist = userLatLong.distanceTo(knotLatLong);

    // Important stuff to know from here:
    // The coords we get from geolocation gives a point and its accuracy. this accuracy is a number
    //      representing the distance in meters from the point in which we can be 95% percent certain
    //      the true location is within. This means, rather than having a definitive point for anything,
    //      we effectively have circles representing locations.
    // With this in mind, the following code attempts to determine if the circles are overlapping by 
    //      checking if the sum of the radii is less than the distance between them
    var userAccuracy = userLocationObj["coords"]["accuracy"];
    var userRadius = userAccuracy < minRadius ? minRadius : userAccuracy;
    var knotAccuracy = targetKnot["destination"]["coords"]["accuracy"];
    var knotRadius = knotAccuracy < minRadius ? minRadius : userAccuracy;
    
    // If the distance between the two is greater than the sum of the radii,
    //      then the two circles don't even intersect at all
    if (dist > userRadius + knotRadius) return false;
    else return true;
}

// On load function:
$w.onReady(function () {
    // Retrieve the user's existing codename from local storage (if present)
    userCodename = local.getItem('codename');
    var pickupsDataset = $w('#pickupsDataset');
    $w('#knotsDataset').onReady(async () => {
        await formDeliveryChain();
        pickupsDataset.onReady(async () => {
            // Get all pickups
            fullPickups = await pickupsDataset.getItems(0, pickupsDataset.getTotalCount());
            // Include knots and then strip them to have only as little detail as we need
            var strippedPickups = includeKnotsAndStrip(fullPickups, fullKnots);
            // Give the stripped results to the custom element
            $w('#mapsElement').setAttribute("pickups", JSON.stringify(strippedPickups));
        })
    });
    // Set up a method to respond to events raised by the custom element
    $w('#mapsElement').on('do-this-one', ({detail: {title, locationObj}}) =>{
        userLocationObj = locationObj;
        $w('#aliasEntry').collapse();
        assessKnot(title);
    })
});

// Create and return a collection of lists that represent the paths the packages have followed
async function formDeliveryChain(){
	var knotsDataset = $w('#knotsDataset');
    // First, get all of the knots
    fullKnots = await knotsDataset.getItems(0, knotsDataset.getTotalCount())
    var allPoints = fullKnots.items;
	// Then we're going to construct a makeshift tree to represent all paths
	var deliveryBranches = [];
	var encounteredIds = [];
	var branches = 0;
	for (var i = 0; i < allPoints.length; i++){
		let item = allPoints[i];
        // Skip empty items (in case they were somehow saved to the collection)
        if (!(item.title) || !(item.destination)) continue;
		if(item.isOrigin === true){
			// If this item is an origin point, then we obviously need to start a new branch
			deliveryBranches.push([toLatLng(item.destination)]);
			encounteredIds.push({
				"_id": item._id,
				"branchIndex": branches,
				"itemIndex": 0,
			});
			branches++;
		}
		else{
			// If the current item isn't an origin, then (because of the sorting) its source id must have already been encountered
			// So we need to find it. findWithAttr() will return the index of the object in the encounteredIds array with the id we're looking for
			// Note: encounter will be {_id, branchIndex, itemIndex}
			let encounter = encounteredIds[findWithAttr(encounteredIds, "_id", item.source)];
			let branch = encounter.branchIndex;
			let pos = encounter.itemIndex;
			// Next we need to know if the encounter represents the end of the branch
			if(pos === deliveryBranches[branch].length - 1){
				// Here, the source of the current item is the end of the respective branch, so we can just append it
				deliveryBranches[branch].push(toLatLng(item.destination));
				encounteredIds.push({
					"_id": item._id,
					"branchIndex": branch,
					"itemIndex": pos + 1,
				});
			}
			else{
				// Otherwise, the source is somewhere in the middle of the branch, meaning we need to start a new branch
				// So we push a new array (branch) to the deliveryBranches array that contains the source and the current item
				deliveryBranches.push([deliveryBranches[branch][pos], toLatLng(item.destination)]);
				encounteredIds.push({
					"_id": item._id,
					"branchIndex": branches,
					"itemIndex": 1,
				});
				branches++;
			}
		}
	}
	// Cool. So at this point, deliveryBranches should be an array of arrays (branches) containing lat lng objects (in order) for google maps to use to draw lines
	$w("#mapsElement").setAttribute("paths", JSON.stringify(deliveryBranches));
}

async function assessKnot(knotIdentifier){
    $w('#closeEnough').collapse();
    $w('#toofar').collapse();
    $w('#aliasError').collapse();
    // Assume that knotIdentifier is a ref code, then, failing that, try for an id
    // Ref code:
    var index = findWithAttr(fullPickups.items, "title", knotIdentifier);
    if(index !== -1){
        targetKnot = fullPickups.items[index].knot;
    }
    // id:
    else{
        index = findWithAttr(fullKnots.items, "_id", knotIdentifier);
        if(index !== -1) targetKnot = fullKnots.items[index];
        else return;
    }
    // Cool, so we found the knot (now targetKnot) or left, so now we can get the user's location and check if they are close enough
    // Whoops, rewrote things a bit, so it's a tiny bit different now. Just know we already have the location object
    //userLocationObj = await getUserLocation();
    if(currentLocationIsCloseEnough()){
        var closeEnoughText = "You are close enough to this package to pick it up and begin a delivery!\nTo begin this delivery enter an allias for us to remember you by below.";
        closeEnoughText += (!(userCodename) || userCodename === "undefined") ? "\nIf you can't think of one, we've pre-supplied a communication-themed one for you" : "\nWe've prefilled your chosen alias, but you are welcome to change it.";
        closeEnoughText += "\nWe need this alias to recognise you when you complete your delivery. We will try and remember it for you, but we encourage you to remember it also.";
        $w("#closeEnough").text = closeEnoughText;
        $w("#aliasField").value = (!(userCodename) || userCodename === "undefined") ? randomUsername() : userCodename;
        $w('#aliasButton').enable();
        $w("#closeEnough").expand();
        $w("#aliasEntry").expand();
    }
    else{
        $w('#toofar').text = "It would appear that you are not close enough to this package to pick it up.\nPlease get closer and select the marker again, or pick a new marker.";
        $w('#toofar').expand();
    }
}

// Returns the index of the first item in an array that has the given attribute, and that attribute is equal to the given value
function findWithAttr(array, attr, value) {
    for(var i = 0; i < array.length; i += 1) {
        if(array[i][attr] && array[i][attr] === value) {
            return i;
        }
    }
    return -1;
}

function toLatLng(obj /*geolocation object*/ ) {
    return {
        'lat': obj.coords.latitude,
        'lng': obj.coords.longitude,
    }
}

// Strips the results from the Pickups database down to just the core details that the custom element needs, allowing us to maximise the data we can use
function stripPickups(results){
	var strippedResults = {"items": []};
	for(var i = 0; i < results.items.length; i++){
		let item = results.items[i];
        // Skip empty items (in case undefined values are somehow saved to a collection)
        if (!(item.title) || !(item.knot.destination)) continue;
		strippedResults.items.push({
			"title": item.title,
			"knot": {
                "destination": {
					"coords": {
						"latitude": item.knot.destination.coords.latitude,
						"longitude": item.knot.destination.coords.longitude,
					}
				}
			}
		});
	}
	return strippedResults;
}

function includeKnotsAndStrip(pickups, knots) {
    for (var i = 0; i < pickups.items.length; i++) {
        if(!(pickups.items[i])) continue;
        var knotIndex = findWithAttr(knots.items, "_id", pickups.items[i].knot);
        if (knotIndex !== -1) {
            pickups.items[i].knot = knots.items[knotIndex];
        }
    }
    return stripPickups(pickups);
}

function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function beginDelivery_click(event) {
    $w('#aliasError').collapse();
	userCodename = $w('#aliasField').value
    userCodename = userCodename.toLowerCase();
    // Let's check for existing codenames
    var allDeliveries = await wixData.query("Deliveries").find();
    if("items" in allDeliveries && findWithAttr(allDeliveries.items, "codename", userCodename) !== -1){
        // If we're here, the user-given codename conflicts with an existing codename
        var newSuggestion;
        var infiniteLoopCatch = 0;
        do{
            newSuggestion = randomUsername();
            infiniteLoopCatch++;
        } while (findWithAttr(allDeliveries.items, "codename", newSuggestion) !== -1 && infiniteLoopCatch < 100);
        $w('#aliasError').text = "There is an existing delivery under the alias you've given. Please choose another. If you'd like a suggestion, try: " + newSuggestion;
        $w('#aliasError').expand();
        return;
    }
    var success = await recordDeliveryInProgress();
    if (!success){
        // Try one more time after waiting a bit
        await sleep(3000);
        success = await recordDeliveryInProgress();
        if (!success){
            wixLocation.to(afterPickupUrl + failedSubmissionQuery);
        }
        else{
            local.setItem("codename", userCodename);
            wixLocation.to(afterPickupUrl);
        }
    }
    else{
        local.setItem("codename", userCodename);
        wixLocation.to(afterPickupUrl);
    }
}

function randomUsername(){
    var exampleAdjectiveIndex = Math.floor(Math.random() * exampleAliasAdjectives.length);
    var exampleNounIndex = Math.floor(Math.random() * exampleAliasNouns.length);
    return exampleAliasAdjectives[exampleAdjectiveIndex] + exampleAliasNouns[exampleNounIndex];
}

export function aliasField_change(event) {
	if($w("#aliasField").value.length > 0) $w('#aliasButton').enable();
    else $w('#aliasButton').disable();
}