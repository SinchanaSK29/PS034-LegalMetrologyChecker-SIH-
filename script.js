const imageInput = document.getElementById("productImage");
const imagePreview = document.getElementById("imagePreview");


// ===============================
// SHOW UPLOADED IMAGE
// ===============================

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


// ===============================
// IMAGE PREPROCESSING
// ===============================

function preprocessImage(file) {

    return new Promise((resolve, reject) => {

        const img = new Image();

        img.onload = function () {

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            // Enlarge image for better OCR
            const scale = 2;

            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            // Draw enlarged image
            ctx.drawImage(
                img,
                0,
                0,
                canvas.width,
                canvas.height
            );

            // Get image pixels
            const imageData = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
            );

            const data = imageData.data;

            // Convert to grayscale
            for (let i = 0; i < data.length; i += 4) {

                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                const gray =
                    0.299 * r +
                    0.587 * g +
                    0.114 * b;

                // Increase contrast
                let contrast = (gray - 128) * 1.5 + 128;

                contrast = Math.max(
                    0,
                    Math.min(255, contrast)
                );

                data[i] = contrast;
                data[i + 1] = contrast;
                data[i + 2] = contrast;
            }

            ctx.putImageData(imageData, 0, 0);

            // Convert processed image to blob
            canvas.toBlob(
                function (blob) {

                    if (!blob) {
                        reject(
                            new Error("Image processing failed.")
                        );
                        return;
                    }

                    resolve(blob);

                },
                "image/png"
            );
        };

        img.onerror = function () {
            reject(
                new Error("Could not load the image.")
            );
        };

        img.src = URL.createObjectURL(file);
    });
}


// ===============================
// ANALYZE PRODUCT
// ===============================

async function analyzeProduct() {

    const file = imageInput.files[0];

    if (!file) {

        alert("Please upload a product image first.");

        return;
    }


    // Result elements

    const productName =
        document.getElementById("productName");

    const netQuantity =
        document.getElementById("netQuantity");

    const mrp =
        document.getElementById("mrp");

    const manufacturer =
        document.getElementById("manufacturer");

    const complianceStatus =
        document.getElementById("complianceStatus");

    const complianceMessage =
        document.getElementById("complianceMessage");

    const ocrText =
        document.getElementById("ocrText");


    // Show processing status

    complianceStatus.textContent =
        "Analyzing product...";

    complianceMessage.textContent =
        "Improving image quality and reading the product label. Please wait.";

    productName.textContent =
        "Scanning...";

    netQuantity.textContent =
        "Scanning...";

    mrp.textContent =
        "Scanning...";

    manufacturer.textContent =
        "Scanning...";

    ocrText.textContent =
        "Preparing image for OCR...";


    document
        .getElementById("resultSection")
        .scrollIntoView({
            behavior: "smooth"
        });


    try {

        // ===============================
        // PREPROCESS IMAGE
        // ===============================

        const processedImage =
            await preprocessImage(file);

        ocrText.textContent =
            "Image enhanced. OCR is reading the label...";


        // ===============================
        // CREATE OCR WORKER
        // ===============================

        const worker =
            await Tesseract.createWorker("eng");


        // ===============================
        // OCR
        // ===============================

        const result =
            await worker.recognize(
                processedImage,
                {
                    tessedit_pageseg_mode: "6"
                }
            );


        const text =
            result.data.text;


        console.log("OCR RESULT:");
        console.log(text);


        // ===============================
        // DISPLAY OCR TEXT
        // ===============================

        ocrText.textContent =
            text.trim() || "No text detected.";


        // ===============================
        // NORMALIZE TEXT
        // ===============================

        const cleanText =
            text
                .replace(/\r/g, "")
                .replace(/[|]/g, "I")
                .trim();


        const lowerText =
            cleanText.toLowerCase();


        // ===============================
        // PRODUCT NAME
        // ===============================

        let detectedProduct =
            "Not detected";


        const lines =
            cleanText
                .split("\n")
                .map(line => line.trim())
                .filter(line => line.length > 2);


        // Try to find a meaningful first line

        for (let line of lines) {

            if (
                !/^(mrp|net|batch|mfg|exp|manufactured|packed|marketed|ingredients|barcode)/i.test(line)
            ) {

                detectedProduct = line;

                break;
            }
        }


        // ===============================
        // NET QUANTITY
        // ===============================

        let detectedQuantity =
            "Not detected";


        const quantityMatch =
            cleanText.match(
                /(?:net\s*(?:quantity|wt|weight)?\s*[:\-]?\s*)?(\d+(?:\.\d+)?\s*(?:kg|kgs|g|gm|gms|mg|ml|l|ltr|litre|liter|ltrs|nos?))/i
            );


        if (quantityMatch) {

            detectedQuantity =
                quantityMatch[1].trim();
        }


        // ===============================
        // MRP
        // ===============================

        let detectedMRP =
            "Not detected";


        const mrpMatch =
            cleanText.match(
                /(?:mrp|maximum\s*retail\s*price)\s*(?:rs\.?|₹|inr)?\s*[:\-]?\s*(?:rs\.?|₹|inr)?\s*(\d+(?:\.\d+)?)/i
            );


        if (mrpMatch) {

            detectedMRP =
                "₹" + mrpMatch[1];
        }


        // Additional MRP pattern
        if (detectedMRP === "Not detected") {

            const alternateMRP =
                cleanText.match(
                    /₹\s*(\d+(?:\.\d+)?)/i
                );

            if (alternateMRP) {

                detectedMRP =
                    "₹" + alternateMRP[1];
            }
        }


        // ===============================
        // MANUFACTURER
        // ===============================

        let detectedManufacturer =
            "Not detected";


        const manufacturerMatch =
            cleanText.match(
                /(?:manufactured\s*by|mfd\.?\s*by|manufacturer|manufactured\s*&?\s*marketed\s*by|packed\s*by)\s*[:\-]?\s*([^\n]+)/i
            );


        if (manufacturerMatch) {

            detectedManufacturer =
                manufacturerMatch[1].trim();
        }


        // ===============================
        // DISPLAY INFORMATION
        // ===============================

        productName.textContent =
            detectedProduct;

        netQuantity.textContent =
            detectedQuantity;

        mrp.textContent =
            detectedMRP;

        manufacturer.textContent =
            detectedManufacturer;


        // ===============================
        // COMPLIANCE SCREENING
        // ===============================

        let missingItems = [];


        if (
            detectedQuantity ===
            "Not detected"
        ) {

            missingItems.push(
                "Net quantity"
            );
        }


        if (
            detectedMRP ===
            "Not detected"
        ) {

            missingItems.push(
                "MRP"
            );
        }


        if (
            detectedManufacturer ===
            "Not detected"
        ) {

            missingItems.push(
                "Manufacturer / packer information"
            );
        }


        // ===============================
        // FINAL RESULT
        // ===============================

        if (missingItems.length === 0) {

            complianceStatus.textContent =
                "Potentially Compliant";

            complianceMessage.textContent =
                "Key declarations were detected from the product label. Human verification is recommended.";

        } else {

            complianceStatus.textContent =
                "Potential Non-Compliance";

            complianceMessage.textContent =
                "The following declarations could not be detected: " +
                missingItems.join(", ") +
                ". Human verification is recommended.";
        }


        // ===============================
        // STOP OCR
        // ===============================

        await worker.terminate();


    } catch (error) {

        console.error(error);


        complianceStatus.textContent =
            "Analysis Failed";


        complianceMessage.textContent =
            "The image could not be processed. Please upload a clear, straight product-label photo.";


        ocrText.textContent =
            "OCR error: " +
            error.message;
    }
}
