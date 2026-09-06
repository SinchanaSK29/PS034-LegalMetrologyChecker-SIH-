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


// Analyze Product
async function analyzeProduct() {

    const file = imageInput.files[0];

    if (!file) {
        alert("Please upload a product image first.");
        return;
    }

    // Get result elements
    const productName = document.getElementById("productName");
    const netQuantity = document.getElementById("netQuantity");
    const mrp = document.getElementById("mrp");
    const manufacturer = document.getElementById("manufacturer");

    const complianceStatus =
        document.getElementById("complianceStatus");

    const complianceMessage =
        document.getElementById("complianceMessage");

    const ocrText =
        document.getElementById("ocrText");


    // Show processing message
    complianceStatus.textContent = "Analyzing product...";
    complianceMessage.textContent =
        "OCR is reading the text from the product label. Please wait.";

    productName.textContent = "Scanning...";
    netQuantity.textContent = "Scanning...";
    mrp.textContent = "Scanning...";
    manufacturer.textContent = "Scanning...";

    ocrText.textContent = "OCR is processing the image...";


    // Scroll to results
    document.getElementById("resultSection").scrollIntoView({
        behavior: "smooth"
    });


    try {

        // Create OCR worker
        const worker = await Tesseract.createWorker("eng");


        // Perform OCR
        const result = await worker.recognize(file);


        // Get extracted text
        const text = result.data.text;


        // Show OCR text
        ocrText.textContent = text || "No text detected.";


        // Simple text-based extraction
        const lowerText = text.toLowerCase();


        // Product name
        let detectedProduct = "Not detected";

        const lines = text
            .split("\n")
            .map(line => line.trim())
            .filter(line => line.length > 2);

        if (lines.length > 0) {
            detectedProduct = lines[0];
        }


        // Net quantity
        let detectedQuantity = "Not detected";

        const quantityMatch = text.match(
            /(?:net\s*(?:quantity|wt|weight)?\s*[:\-]?\s*)?(\d+(?:\.\d+)?\s*(?:kg|g|mg|ml|l|litre|liter))/i
        );

        if (quantityMatch) {
            detectedQuantity = quantityMatch[1];
        }


        // MRP
        let detectedMRP = "Not detected";

        const mrpMatch = text.match(
            /(?:mrp|maximum\s*retail\s*price)[^\d₹]*₹?\s*(\d+(?:\.\d+)?)/i
        );

        if (mrpMatch) {
            detectedMRP = "₹" + mrpMatch[1];
        }


        // Manufacturer
        let detectedManufacturer = "Not detected";

        const manufacturerMatch = text.match(
            /(?:manufactured\s*by|manufacturer)[\s:\-]*(.*)/i
        );

        if (manufacturerMatch) {
            detectedManufacturer =
                manufacturerMatch[1].trim();
        }


        // Put extracted information on screen
        productName.textContent = detectedProduct;
        netQuantity.textContent = detectedQuantity;
        mrp.textContent = detectedMRP;
        manufacturer.textContent = detectedManufacturer;


        // Basic compliance screening
        let missingItems = [];

        if (detectedQuantity === "Not detected") {
            missingItems.push("Net quantity");
        }

        if (detectedMRP === "Not detected") {
            missingItems.push("MRP");
        }

        if (detectedManufacturer === "Not detected") {
            missingItems.push("Manufacturer information");
        }


        if (missingItems.length === 0) {

            complianceStatus.textContent =
                "Potentially Compliant";

            complianceMessage.textContent =
                "Required key declarations were detected by OCR. Human verification is recommended.";

        } else {

            complianceStatus.textContent =
                "Potential Non-Compliance";

            complianceMessage.textContent =
                "The following information could not be detected: " +
                missingItems.join(", ") +
                ". Human verification is recommended.";
        }


        // Stop OCR worker
        await worker.terminate();


    } catch (error) {

        console.error(error);

        complianceStatus.textContent =
            "Analysis Failed";

        complianceMessage.textContent =
            "OCR could not process this image. Please try a clearer product label image.";

        ocrText.textContent =
            "OCR error: " + error.message;
    }
}
