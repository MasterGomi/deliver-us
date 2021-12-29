export function form_input(event) {
	$w('#addressField').value.length > 0 && $w('#emailField').value.length > 0 ? $w('#submitButton').enable() : $w('#submitButton').disable();
}

export async function submitButton_click(event) {
	var submitButton = $w('#submitButton');
	var requestsDatabase = $w("#requestsDatabase");
	$w('#error').collapse();
	submitButton.disable();
	submitButton.label = "Submitting...";
	requestsDatabase.setFieldValues({"location": $w('#addressField').value, "email": $w('#emailField').value});
	var success = await requestsDatabase.save().then(() => {return true;}, () => {return false;});
	if(success){
		submitButton.label = "Done";
		$w('#done').expand();
	}
	else{
		submitButton.label = "Submit request";
		submitButton.enable();
		$w('#error').expand();
	}
}