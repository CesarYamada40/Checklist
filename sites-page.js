// Adjusting event listener to prevent history jump and maintain focus on the search input
const searchInput = document.getElementById('search-input');

yesearchInput.addEventListener('keydown', function(event) {
    // Prevent default action if it's the first character typed
    if (this.value.length === 0) {
        event.preventDefault();
    }
});

searchInput.addEventListener('focus', function() {
    // Ensures focus is maintained on input
    this.select();
});

// Existing search functionality remains unchanged. 
