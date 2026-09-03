const imageInput = document.getElementById("productImage");
const imagePreview = document.getElementById("imagePreview");


// Show uploaded image
imageInput.addEventListener("change", function () {

    const file = imageInput.files[0];

    if (!file) {
        return;
    }

    const imageURL = URL.createObjectURL(file);

    imagePreview.innerHTML = `
        <img src="${imageURL}" alt="Uploaded product">
    `;
});


// Temporary analysis function
function analyzeProduct() {

    if (imageInput.files.length === 0) {

        alert("Please upload a product image first.");

        return;
    }

    document.getElementById("productName").textContent =
        "Demo Product";

    document.getElementById("netQuantity").textContent =
        "1 kg";

    document.getElementById("mrp").textContent =
        "₹120";

    document.getElementById("manufacturer").textContent =
        "Detected";

    document.getElementById("complianceStatus").textContent =
        "Potential Non-Compliance";

    document.getElementById("complianceMessage").textContent =
        "This is a demo result. Real OCR and Legal Metrology rule checking will be connected next.";
}
