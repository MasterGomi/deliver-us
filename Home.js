// API Reference: https://www.wix.com/corvid/reference
// “Hello, World!” Example: https://www.wix.com/corvid/hello-world

import {local} from 'wix-storage';
import wixLocation from 'wix-location';

var fullKnots;

$w.onReady(function () {
	// Check if a codename was included in the url query
	var includedCodename = wixLocation.query["codename"];
	// If it was, save it to local storage
	if (includedCodename !== null) local.setItem("codename", includedCodename);
	var pickupsDataset = $w('#pickupsDataset');
	$w('#knotsDataset').onReady(async () => {
		await formDeliveryChain();
		pickupsDataset.onReady(async () => {
			// Get all pickups
			var allPickups = await pickupsDataset.getItems(0, pickupsDataset.getTotalCount());
			// Include knots and then strip them to have only as little detail as we need
			var strippedPickups = includeKnotsAndStrip(allPickups, fullKnots);
			// Give the stripped results to the custom element
			$w('#mapsElement').setAttribute("pickups", JSON.stringify(strippedPickups));
		})
	});
});

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
		if(!(item.title) || !(item.destination)) continue;
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

function includeKnotsAndStrip(pickups, knots){
	for(var i = 0; i < pickups.items.length; i++){
		if(!(pickups.items[i])) continue;
		var knotIndex = findWithAttr(knots.items, "_id", pickups.items[i].knot);
		if(knotIndex !== -1){
			pickups.items[i].knot = knots.items[knotIndex];
		}
	}
	return stripPickups(pickups);
}

function stripPickups(results){
	var strippedResults = {"items": []};
	for(var i = 0; i < results.items.length; i++){
		let item = results.items[i];
		// Skip empty items (in case undefined values are somehow saved to a collection)
		if(!(item.title) || !(item.knot.destination)) continue;
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

function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
}