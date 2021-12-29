// For full API documentation, including code examples, visit https://wix.to/94BuAAs
import wixLocation from 'wix-location';
import wixWindow from 'wix-window';
import wixData from 'wix-data';
import { local } from 'wix-storage';

const shareBody = "Deliver Us is a Melbourne-based, real world experience. Walk a shared digital package to its next location while listening to an immersive audio narrative, and become a part of something bigger.\n@DeliverUsG #DeliverUsGame\ndeliver-us.net";
const twitterLink = "https://twitter.com/intent/tweet?original_referer=https%3A%2F%2Fstatic.parastorage.com%2F&ref_src=twsrc%5Etfw&related=DeliverUsG&text=" + encodeURIComponent(shareBody);

// Dataset refs
var deliveriesDataset;
var messagesDataset;
//var promptsDataset;
var knotsDataset;
var problemsDataset;
// These are probably unnecessary, just a safety thing
var delDataReady = false;
var messagesReady = false;

// Yay! I'm using global variables and no one can stop me. This is liberating. I mean, it's also almost neccesary in JS
var deliveryInProgressObj = null;
var userLocationObj = null;
var confirmedLocationPermission = false;
var codename = null;
var aliasError = "";
var deliveryError = "";
var promptObj = null;
var submittedMessage = false;
var failedCodename = false;
var failedLocation = false;

async function retrieveDelivery(deliveryCodename) {
    var loopTries = 20;
    // This is almost certainly not going to be an issue, but better safe than sorry, I guess
    while(!delDataReady && loopTries > 0){
        await sleep(1500);
        loopTries--;
    }
    if (!delDataReady){
        aliasError = "Something has gone wrong while trying to retrieve your delivery. Try refreshing the page.\nIf the error persists, please email admin@deliver-us.net and cite error code 408";
        return null;
    }
    await deliveriesDataset.setFilter(wixData.filter().eq("codename", deliveryCodename));
    // Will return null if no items match filter, or the first (only) item that does
    return await deliveriesDataset.getCurrentItem();
    
    /* I'm keeping this here as a solem reminder of how I was shooting myself in the foot with all of my direct database work
    if (retrying) await sleep(queryStallTime);
    // Queries the Deliveries database for an entry with a matching codename and returns the first result
    // Note: in current implementation, this will only return the first result, meaning that codename duplications must be handled elsewhere (pretty sure it's sorted)
    return await wixData.query("Deliveries")
        .include("Knots")
        .eq("codename", deliveryCodename)
        .find()
        .then((results) => {
            if(results.items.length === 0) {
                aliasError = "We couldn't find an in-progress delivery matching that alias. Please check that you have entered it correctly and try again."
                + "\nIf the error persits, please email admin@deliver-us.net, citing your alias";
                return null;
            }
            // There should be absolutely no way of the query returning more than one result. Codename is the primary key and is unique
            return results.items[0];
        }, async (error) => {
            console.log("Delivery retrieval failed. Error: " + error);
            aliasError = "Something unhandled has gone wrong. Please try again in a short while. If the error repeats, please email admin@deliver-us.net and cite:\n" 
            + "Error: " + error + ". Alias: " + deliveryCodename;
            return retrying ? null : await retrieveDelivery(deliveryCodename, true);
        });
    */
}

async function getUserLocation() {
    return await wixWindow.getCurrentGeolocation().then((obj) => { failedLocation = false; return obj; }, (error) => { console.log("Error getting location: " + error); failedLocation = true; return null;});
}

// Save the completed delivery to the Knots database
// Requires deliveryInProgressObj and userLocationObj to be correctly defined
async function submitDelivery() {
    var submission = {
        "destination": userLocationObj,
        "source": deliveryInProgressObj.origin,
        "isOrigin": false,
        "title": codename + Math.floor(Math.random() * 10000),
        "artificial": false,
    };
    knotsDataset.setFieldValues(submission);
    return await knotsDataset.save().then(() => {return true;}, () => {return false;});
}

// On click function for submitting deliveries
async function deliveryConfirm(){
    if (userLocationObj === null){
        console.log("userLocationObj not set");
        // Alert the user that we need to have permission to retrieve location data for this to work
        // Alert the user that if it still isn't workng, check if location services are enabled
        // Perhaps provide them with an opportunity to inform us of what's wrong?
        deliveryError = "It looks like we can't get your location. Please check that your device's location services are enabled and that you have given our website location permissions, then try again."
        + "\nIf the error persists and the issue can't be resolved, you can still continue onwards from this point, but please note that your delivery won't be fully completed, meaning your addition to "
        + "the delivery chain won't be visible on the map. Your response below will still be recorded, however.\n";
        $w('#deliveryError').text = deliveryError;
        $w('#deliveryError').expand();
        $w('#alternateContinue').expand();
        return;
    }
    else if (failedCodename) {
        // If they failed their alias above, but their location is fine, we can have the regular delivery submit button go straight to alternate protocol
        alternateContinue_click();
        return
    }
    else{
        $w('#deliveryError').collapse();
        $w('#alternateContinue').collapse();
    }
    
    var deliverySuccessful = await submitDelivery();
    if (!deliverySuccessful){
        // Error handling for unsuccessful inserts
        // Note: if we're sure that userLocationObj and deliveryInProgressObj are filled and valid, that likely means that it's a backend problem
        console.log("Error: Delivery was unsuccessfully submitted");
    }
    else{
        // Submission was a success, so delete the delvery in progress
        wixData.remove("Deliveries", deliveryInProgressObj._id);
        // Note: at this point, even if something did happen to go wrong, we have to commit to telling the user it worked regardless
    }
}

// Submit a delivery with any problems to the "Problems" database to help identify backend issues and resolve bugs
async function submitBrokenDelivery(){
    var toSubmit = {};
    if (codename === null) codename = "[unknown]";
    toSubmit.title = codename + Math.floor(Math.random() * 10000);
    toSubmit.attemptedCodename = codename;
    toSubmit.error = "";
    if(!failedCodename){
        await deliveriesDataset.setFilter(wixData.filter().eq("_id", deliveryInProgressObj._id))
        deliveriesDataset.setFieldValues({
            "codename": deliveryInProgressObj.codename + "[failed]",
            "failed": true,
        });
        deliveriesDataset.save();
        toSubmit.delivery = deliveryInProgressObj._id;
    }
    else{
        toSubmit.error += "User failed to submit a valid codename. ";
    }
    if(!failedLocation){
        toSubmit.destination = userLocationObj;
    }
    else{
        toSubmit.error += "Couldn't retrieve user's location.";
    }
    problemsDataset.setFieldValues(toSubmit);
    return await problemsDataset.save().then(() => {return true;}, () => {return false;});
}

async function selectMessage(){
    // Make sure to only grab an approved message
    await messagesDataset.setFilter(wixData.filter().eq("approved", true));
    var index = Math.floor(Math.random() * messagesDataset.getTotalCount());
    await messagesDataset.setCurrentItemIndex(index);
    var messageObj = messagesDataset.getCurrentItem();
    $w('#packageMessage').text = messageObj.response;
    messagesDataset.setFilter(wixData.filter());
    messagesReady = true;
}

async function submitMessage(){
    // This is the last thing we do on this page, if the dataset isn't loaded yet, something's gone horribly wrong. Might as well wait a bit anyway though
    var loopTries = 20
    while (!messagesReady && loopTries > 0){
        await sleep(1500);
        loopTries--;
    }
    if (!messagesReady){
        console.log("newMessages dataset didn't get ready in time. Message not submitted");
        return; // If the newMessages dataset doesn't get ready, we'll just have to abandon it
    }
    submittedMessage = true;
    var toSubmit = {
        //"prompt": promptObj._id,
        "response": $w('#responseBox').value,
        "shareable": $w('#postConsent').checked,
        "reviewed": false,
        "approved": false,
    };
    // Create a new (empty) object in the Messages dataset
    messagesDataset.new().then(() => {repeatSave(toSubmit, messagesDataset);}, () => {
        messagesDataset.new().then(() => {repeatSave(toSubmit, messagesDataset);}, () => {
            messagesDataset.new().then(() => {repeatSave(toSubmit, messagesDataset);});
        })
    });
}

async function repeatSave(toSave, dataset, tries = 3){
    if(tries <= 0) return;
    dataset.setFieldValues(toSave);
    return await dataset.save().then(() => {return}, async () => {await repeatSave(toSave, dataset, tries - 1);});
}

// On load function:
$w.onReady(function () {
    deliveriesDataset = $w('#deliveriesDataset');
    messagesDataset = $w('#messagesDataset');
    //promptsDataset = $w('#promptsDataset');
    knotsDataset = $w('#knotsDataset');
    problemsDataset = $w('#problemsDataset');
    // Will be null if not present
    codename = local.getItem("codename");
    // If present, pre-fill it
    if (codename && codename !== "undefined") {
        $w('#aliasField').value = codename;
        $w('#aliasButton').enable();
    }
    else $w('#aliasField').value = "";
    deliveriesDataset.onReady(function () {delDataReady = true;});
    // We'll grab the message as soon as it's ready, then also flag messagesReady
    messagesDataset.onReady(selectMessage);
    // All we need the prompt database for is to get the prompt, so just do that as soon as its ready, since we don't need user input for it
    //promptsDataset.onReady(selectPrompt);
});

export function postingLink_click(event) {
	var postingText = $w('#postingText');
    postingText.collapsed ? postingText.expand() : postingText.collapse();
}

export function responseBox_input(event) {
	var completeDeliveryButton = $w('#completeDeliveryButton');
    ($w('#responseBox').value.length > 0 && !submittedMessage) ? completeDeliveryButton.enable() : completeDeliveryButton.disable();
}

export function aliasField_input(event) {
	var aliasButton = $w('#aliasButton');
    ($w('#aliasField').value.length > 0 && !submittedMessage) ? aliasButton.enable() : aliasButton.disable();
}

export async function aliasButton_click(event) {
    // Don't go through the effort again if they're entering the same codename
	if(deliveryInProgressObj !== null && codename === $w('#aliasField').value.toLowerCase()) return;
    var aliasButton = $w('#aliasButton');
    aliasButton.disable();
    $w('#aliasError').collapse();
    collapsePromptGroup();
    var ogButtonText = aliasButton.label;
    aliasButton.label = "Searching...";
    codename = $w('#aliasField').value.toLowerCase();
    deliveryInProgressObj = await retrieveDelivery(codename);
    if (deliveryInProgressObj === null) {
        failedCodename = true;
        if (aliasError === "") aliasError = "We couldn't find a delivery under that alias. Please check what you have entered and try again.\nIf the problem persists, please email admin@deliver-us.net and cite your alias." + 
        "\nWe encourage you to continue the process below if it isn't working or you can't remember your alias, only you won't leave a pin in the map, unless it can later be resolved server-side.";
        $w('#aliasError').text = aliasError;
        $w('#aliasError').expand();
        aliasButton.label = ogButtonText;
        aliasButton.enable();
        expandPromptGroup();
    }
    else{
        failedCodename = false;
        expandPromptGroup();
        aliasButton.label = ogButtonText;
        aliasButton.enable();
    }
}

function collapsePromptGroup(){
    $w('#promptText').collapse();
    $w('#responseBox').collapse();
    $w('#postConsent').collapse();
    $w('#postingLink').collapse();
    $w('#completeDeliveryButton').collapse();
}

function expandPromptGroup(){
    $w('#promptText').expand();
    $w('#responseBox').expand();
    $w('#postConsent').expand();
    $w('#postingLink').expand();
    $w('#completeDeliveryButton').expand();
}

function collapsePostSubmissionGroup(){
    $w('#text5').collapse();
    $w('#text6').collapse();
    $w('#text7').collapse();
    $w('#text8').collapse();
    $w('#packageMessage').collapse();
    $w('#tweetButton').collapse();
    $w('#facebookShare1').collapse();
}

function expandPostSubmissionGroup(){
    $w('#text5').expand();
    $w('#text6').expand();
    $w('#text7').expand();
    $w('#text8').expand();
    $w('#packageMessage').expand();
    $w('#tweetButton').expand();
    $w('#facebookShare1').expand();
}

export async function completeDeliveryButton_click(event) {
	var deliveryButton = $w('#completeDeliveryButton');
    var ogDeliveryLabel = deliveryButton.label;
    deliveryButton.disable();
    deliveryButton.label = "Completing...";
    userLocationObj = await getUserLocation();
    await deliveryConfirm();
    if($w('#deliveryError').collapsed){
        $w('#successMessage').expand();
        $w('#completeDeliveryButton').label = "Done";
        // The delivery button is to remain disabled, we don't need the user submitting anything again
        $w('#aliasButton').disable()
        expandPostSubmissionGroup();
        // We don't need to wait for it, it can stay asynchronous
        submitMessage();
    }
    else{
        deliveryButton.enable();
        deliveryButton.label = ogDeliveryLabel;
    }
}

export async function alternateContinue_click(event = null) {
	$w('#alternateContinue').disable();
    $w('#completeDeliveryButton').disable();
    $w('#aliasButton').disable();
    expandPostSubmissionGroup();
    submitMessage();
    submitBrokenDelivery();
}

// Sneaky function to stall a thread for [ms] ms (assuming that it is awaited)
function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function tweetButton_click(event) {
	wixLocation.to(twitterLink);
}