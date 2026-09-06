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


// Analyze Product using OCR
async function analyzeProduct() {

    if (imageInput.files.length === 0) {

        alert("Please upload a product image first.");

        return;
    }

    const file = imageInput.files[0];

    // Show analysis status
    document.getElementById("complianceStatus").textContent =
        "Analyzing product...";

    document.getElementById("complianceMessage").textContent =
        "OCR is reading the text from the product label. Please wait...";

    document.getElementById("ocrText").textContent =
        "OCR analysis in progress...";

    try {

        // Create OCR worker
        const worker = await Tesseract.createWorker("eng");

        // Recognize text from uploaded image
        const result = await worker.recognize(file);

        // Get extracted text
        const extractedText = result.data.text;

        // Display OCR text
        document.getElementById("ocrText").textContent =
            extractedText || "No readable text found.";

        // Stop OCR worker
        await worker.terminate();


        // Extract basic information from OCR text
        extractProductDetails(extractedText);


        // Show result
        document.getElementById("complianceStatus").textContent =
            "OCR Analysis Completed";

        document.getElementById("complianceMessage").textContent =
            "The label text has been extracted successfully. Potential compliance checking will be performed next.";

    }

    catch (error) {

        console.error("OCR Error:", error);

        document.getElementById("ocrText").textContent =
            "Unable to extract text from this image.";

        document.getElementById("complianceStatus").textContent =
            "OCR Analysis Failed";

        document.getElementById("complianceMessage").textContent =
            "Please try again with a clearer, high-resolution product label image.";
    }
}


// Extract basic product details from OCR text
function extractProductDetails(text) {

    const lines = text
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);


    // Product name
    if (lines.length > 0) {

        document.getElementById("productName").textContent =
            lines[0];
    }


    // Net Quantity
    const quantityMatch = text.match(
        /(?:net\s*quantity|net\s*wt|net\s*weight)\s*[:\-]?\s*([0-9.]+\s*(?:kg|g|mg|l|ml|L|mL))/i
    );

    if (quantityMatch) {

        document.getElementById("netQuantity").textContent =
            quantityMatch[1];
    }
    else {

        document.getElementById("netQuantity").textContent =
            "Not detected";
    }


    // MRP
    const mrpMatch = text.match(
        /MRP\s*[:\-]?\s*(?:Rs\.?|₹)?\s*([0-9]+(?:\.[0-9]{1,2})?)/i
    );

    if (mrpMatch) {

        document.getElementById("mrp").textContent =
            "₹" + mrpMatch[1];
    }
    else {

        document.getElementById("mrp").textContent =
            "Not detected";
    }


    // Manufacturer
    const manufacturerMatch = text.match(
        /(?:manufactured\s*by|manufactured\s*&\s*marketed\s*by|manufactured\s*at)\s*[:\-]?\s*(.*)/i
    );

    if (manufacturerMatch) {

        document.getElementById("manufacturer").textContent =
            manufacturerMatch[1];
    }
    else {

        document.getElementById("manufacturer").textContent =
            "Not detected";
    }
}
