// Back-end miscellaneous database handling for validation, cleaning, and other purposes

import wixData from 'wix-data';
import {notify} from 'backend/notify';
// notify(title, message)

// Quick definitions for readability
const seconds = 1000;
const minutes = 60 * seconds;
const hours = 60 * minutes;
const days = 24 * hours;

const pickupSimpleTitles = [
	"memo",
	"letter",
	"parcel",
	"origin",
	"whisper",
	"shout",
	"message",
	"note",
	"page",
]
const maxAppendNumber = 999;
const noHooks = {'suppressHooks':true};
// How long do pick-up points stay active?
const pickupTTL = 12 * hours;

function makeSimpleRefCode(){
	// Makes a simple code that can be used to refer to an entry in the Active Pick-up Points database as the title,
	//		meaning that it can be displayed on the map for users to refer to it by
	// Get the index for a random word in the pickupSimpleTitles array. e.g. 3 (resolves to "origin")
	var titleIndex = Math.floor(Math.random() * pickupSimpleTitles.length);
	// Get a random number between 1 and maxAppendNumber (inclusive). e.g. 376
	var appendNumber = Math.floor(Math.random() * maxAppendNumber) + 1;
	// Combine them to form the simple ref title. e.g. origin376
	return pickupSimpleTitles[titleIndex] + appendNumber;
}

export function Knots_afterInsert(item, context) {
	// This hook adds a new active pick-up location for this new packakge and handles expiry of the relevant pick-up point
	// Note: item represents the item added to the Knots collection
	// If the item added was somehow empty (had undefined key values), we will remove it from the collection, then exit this hook
	if(!(item.title) || !(item.destination) || (!(item.source) && !(item.isOrigin))){
		wixData.remove("Knots", item._id, noHooks);
		return item;
	}
	// Notify me about the new knot
	if (!item.artificial) notify("New knot", "New knot added to the Knots database. Title: " + item.title);
	// First, add a pickup point for the newly created knot to the Active Pick-up Points database
	var newPickup = {
		"title": makeSimpleRefCode(),
		"knot": item._id,
	};
	wixData.insert("PickupLocations", newPickup, noHooks)
	// Note that we don't have to wait for the insert to finish, we don't care for the rest of this function

	// Then check the Active Pick-up Points database to see if the pick-up point for the package we just delivered
	//		has a recorded deliveredTime property and set it if it hasn't, so that we know when to remove it
	// Try and find an active pick-up entry that corresponds to the package that has just been delivered
	if(item.source) {
		console.log("about to query");
		wixData.query("PickupLocations")
		.include("Knots")
		.eq("knot", item.source._id)
		.find(noHooks)
		.then((results) => {
			// We expect to get 1 or 0 results
			if(results.items.length > 0){
				// Since we only expect one result, we can just alias results.items[0]
				let result = results.items[0];
				// Check whether or not the result has already been marked for disposal
				if(!(result.deliveredTime)){
					// If it hasn't, set it's deliveredTime property to now
					let newEntry = {
						"_id": result._id,
						"title": result.title,
						"knot": result.knot,
						"deliveredTime": new Date(Date.now()),
					}
					// Then update the entry in the database
					//await sleep(1500);
					console.log("about to Update");
					wixData.update("PickupLocations", newEntry, noHooks);
				}
				else {
					// If it has already been defined, we might as well see if it has expired yet
					// Get the deliverTime and current time in ms since epoch
					let resultDeliveredTime = Date.parse(result.deliveredTime);
					let now = Date.now();
					// Find how much time has passed since deliveredTime
					let diff = now - resultDeliveredTime;
					// If more time has passed than the TTL, remove it from the database
					if(diff >= pickupTTL){
						//await sleep(1500);
						console.log("about to remove");
						wixData.remove("PickupLocations", result._id, noHooks);
					}
				}
			}
		}, (error) => {console.log(error);});
	}

	return item;
}

async function checkTTL(item){
	// Then check the Active Pick-up Points database to see if the pick-up point for the package we just delivered
	//		has a recorded deliveredTime property and set it if it hasn't, so that we know when to remove it
	// Try and find an active pick-up entry that corresponds to the package that has just been delivered
	if(item.source) {
		console.log("about to query");
		wixData.query("PickupLocations")
		.eq("knot", item.source)
		.find(noHooks)
		.then(async (results) => {
			// We expect to get 1 or 0 results
			console.log("found: " + JSON.stringify(results));
			if(results.items.length > 0){
				// Since we only expect one result, we can just alias results.items[0]
				let result = results.items[0];
				// Check whether or not the result has already been marked for disposal
				if(!(result.deliveredTime)){
					// If it hasn't, set it's deliveredTime property to now
					let newEntry = {
						"_id": result._id,
						"title": result.title,
						"knot": result.knot,
						"deliveredTime": new Date(Date.now()),
					}
					// Then update the entry in the database
					await sleep(1500);
					console.log("about to Update");
					wixData.update("PickupLocations", newEntry, noHooks);
				}
				else {
					// If it has already been defined, we might as well see if it has expired yet
					// Get the deliverTime and current time in ms since epoch
					let resultDeliveredTime = Date.parse(result.deliveredTime);
					let now = Date.now();
					// Find how much time has passed since deliveredTime
					let diff = now - resultDeliveredTime;
					// If more time has passed than the TTL, remove it from the database
					if(diff >= pickupTTL){
						await sleep(1500);
						console.log("about to remove");
						wixData.remove("PickupLocations", result._id, noHooks);
					}
				}
			}
		}, (error) => {console.log(error);});
	}
}

// Sneaky function to stall a thread for [ms] ms (assuming that it is awaited)
function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function PickupLocations_beforeQuery(query, context) {
	// This hook quickly (well, quickly as possible) checks for any expired pickup points and removes them before the query completes
	wixData.query("PickupLocations")
		.find(noHooks)	// NEEDS to be no hooks or we'll be stuck in an infinite loop
		.then((results) =>{
			for (var i = 0; i < results.items.length; i++) {
				let item = results.items[i];
				// item represents a record in the PickupLocations database
				if(item.deliveredTime){
					let deliveredTime = Date.parse(item.deliveredTime);
					let now = Date.now();
					// Find how much time has passed since deliveredTime
					let diff = now - deliveredTime;
					// If more time has passed than the TTL, remove it from the database
					if(diff >= pickupTTL){
						wixData.remove("PickupLocations", item._id, noHooks).then();
					}
				}
			}
		})
	return query;
}

function objectPropertyExists(array, property, value){
	return array.some(element => element[property] === value);
}

/*
export function PickupLocations_beforeInsert(item, context) {
	// Code to check for repeated ref codes (highly unlikely to occur)
	wixData.query("PickupLocations")
		.find(noHooks)
		.then((results) => {
			if(results.items.length > 0){
				while(objectPropertyExists(results.items, "title", item.title)){item.title = makeSimpleRefCode();}
			}
		})
	// Note that at this point, if we needed to change the title of the item we're adding, that is already reflected in 'item'
	return item;
}
*/

/*
export function Deliveries_beforeInsert(item, context) {
	item.title = item.title.toLowerCase();
	return item;
}
*/

/*
export function Deliveries_afterQuery(item, context) {
	return replaceOnNew(item, "title", item.title.toLowerCase());
}
*/

function replaceOnNew(obj, member, newValue){
	var newObj = JSON.parse(JSON.stringify(obj));
	newObj[member] = newValue;
	return newObj;
}

export function Knots_onFailure(error, context) {
	wixData.insert("onFailureErrors", {"error": error.message, "source": "Knots"});
}

export function PickupLocations_onFailure(error, context) {
	wixData.insert("onFailureErrors", {"error": error.message, "source": "Pickups"});
}

export function Deliveries_onFailure(error, context) {
	wixData.insert("onFailureErrors", {"error": error.message, "source": "Deliveries"});
}

export function Messages_onFailure(error, context) {
	wixData.insert("onFailureErrors", {"error": error.message, "source": "Messages"});
}

export function onFailureErrors_afterInsert(item, context) {
	notify("New onFailure from " + item.source, "Error contents:\n" + item.error);
}

export function ProblemDeliveries_afterInsert(item, context) {
	notify("New problem delivery", "New problem delivery");
}

export function Requests_afterInsert(item, context) {
	notify("New request", "Request for " + item.location);
}