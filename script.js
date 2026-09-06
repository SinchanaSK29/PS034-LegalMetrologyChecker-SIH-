const imageInput = document.getElementById("productImage");
const imagePreview = document.getElementById("imagePreview");


// =====================================================
// SHOW UPLOADED IMAGE
// =====================================================

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


// =====================================================
// IMAGE PREPROCESSING
// =====================================================

function preprocessImage(file) {

    return new Promise((resolve, reject) => {

        const img = new Image();

        img.onload = function () {

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            // Enlarge image
            const scale = 2;

            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            ctx.drawImage(
                img,
                0,
                0,
                canvas.width,
                canvas.height
            );

            // Convert to grayscale + increase contrast
            const imageData = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
            );

            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {

                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                const gray =
                    0.299 * r +
                    0.587 * g +
                    0.114 * b;

                let contrast =
                    (gray - 128) * 1.4 + 128;

                contrast = Math.max(
                    0,
                    Math.min(255, contrast)
                );

                data[i] = contrast;
                data[i + 1] = contrast;
                data[i + 2] = contrast;
            }

            ctx.putImageData(imageData, 0, 0);

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
                new Error("Could not load image.")
            );

        };

        img.src = URL.createObjectURL(file);
    });
}


// =====================================================
// CROP LOWER DECLARATION SECTION
// =====================================================

function createDeclarationCrop(file) {

    return new Promise((resolve, reject) => {

        const img = new Image();

        img.onload = function () {

            const canvas =
                document.createElement("canvas");

            const ctx =
                canvas.getContext("2d");

            /*
             * Most packaged products place legal
             * declarations in the lower/back section.
             *
             * We take the lower 55% of the image.
             */

            const cropY =
                Math.floor(img.height * 0.45);

            const cropHeight =
                img.height - cropY;

            const scale = 2;

            canvas.width =
                img.width * scale;

            canvas.height =
                cropHeight * scale;

            ctx.drawImage(
                img,
                0,
                cropY,
                img.width,
                cropHeight,
                0,
                0,
                canvas.width,
                canvas.height
            );

            // Grayscale + contrast
            const imageData =
                ctx.getImageData(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );

            const data =
                imageData.data;

            for (let i = 0; i < data.length; i += 4) {

                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                const gray =
                    0.299 * r +
                    0.587 * g +
                    0.114 * b;

                let contrast =
                    (gray - 128) * 1.6 + 128;

                contrast = Math.max(
                    0,
                    Math.min(255, contrast)
                );

                data[i] = contrast;
                data[i + 1] = contrast;
                data[i + 2] = contrast;
            }

            ctx.putImageData(
                imageData,
                0,
                0
            );

            canvas.toBlob(
                function (blob) {

                    if (!blob) {

                        reject(
                            new Error(
                                "Declaration crop failed."
                            )
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
                new Error(
                    "Could not create declaration crop."
                )
            );

        };

        img.src =
            URL.createObjectURL(file);
    });
}


// =====================================================
// CLEAN OCR TEXT
// =====================================================

function cleanOCRText(text) {

    return text
        .replace(/\r/g, "")
        .replace(/[|]/g, "I")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .trim();
}


// =====================================================
// FIND PRODUCT / COMMODITY
// =====================================================

function extractCommodity(text) {

    let match =
        text.match(
            /commodity\s*[:\-]?\s*([^\n]+)/i
        );

    if (match) {

        return match[1]
            .trim()
            .replace(/[|]/g, "")
            .trim();
    }

    return "Not detected";
}


// =====================================================
// FIND NET QUANTITY
// =====================================================

function extractQuantity(text) {

    // Example:
    // Net Quantity: 1U
    // Net Quantity: 500 g
    // Net Qty: 1 kg
    // Net Quantity: 2 PCS

    let match =
        text.match(
            /net\s*(?:quantity|qty)?\s*[:\-]?\s*(\d+(?:\.\d+)?\s*(?:kg|kgs|g|gm|gms|mg|ml|l|ltr|litre|liter|ltrs|u|unit|units|pcs|pc|nos|no))/i
        );

    if (match) {

        return match[1]
            .trim()
            .replace(/\s+/g, " ");
    }


    // Backup search
    match =
        text.match(
            /\b(\d+(?:\.\d+)?\s*(?:kg|kgs|g|gm|gms|mg|ml|l|ltr|litre|liter|ltrs|u|unit|units|pcs|pc|nos|no))\b/i
        );

    if (match) {

        return match[1]
            .trim()
            .replace(/\s+/g, " ");
    }

    return "Not detected";
}


// =====================================================
// FIND MRP
// =====================================================

function extractMRP(text) {

    let match =
        text.match(
            /(?:maximum\s*retail\s*price|mrp)\s*[:\-]?\s*(?:rs\.?|₹|inr)?\s*(\d+(?:\.\d{1,2})?)/i
        );

    if (match) {

        return "₹" + match[1];
    }


    // Backup ₹ amount
    match =
        text.match(
            /₹\s*(\d+(?:\.\d{1,2})?)/i
        );

    if (match) {

        return "₹" + match[1];
    }


    // Backup Rs amount
    match =
        text.match(
            /\brs\.?\s*(\d+(?:\.\d{1,2})?)/i
        );

    if (match) {

        return "₹" + match[1];
    }


    return "Not detected";
}


// =====================================================
// FIND MANUFACTURER
// =====================================================

function extractManufacturer(text) {

    let match =
        text.match(
            /manufactured\s*by\s*[:\-]?\s*([^\n]+)/i
        );

    if (match) {

        return match[1]
            .trim()
            .replace(/[|]/g, "")
            .trim();
    }


    // Backup: Mfd by
    match =
        text.match(
            /mfd\.?\s*by\s*[:\-]?\s*([^\n]+)/i
        );

    if (match) {

        return match[1]
            .trim()
            .replace(/[|]/g, "")
            .trim();
    }


    return "Not detected";
}


// =====================================================
// FIND MARKETED BY
// =====================================================

function extractMarketedBy(text) {

    let match =
        text.match(
            /marketed\s*by\s*[:\-]?\s*([^\n]+)/i
        );

    if (match) {

        return match[1]
            .trim()
            .replace(/[|]/g, "")
            .trim();
    }

    return "Not detected";
}


// =====================================================
// FIND COUNTRY OF ORIGIN
// =====================================================

function extractCountry(text) {

    let match =
        text.match(
            /country\s*of\s*origin\s*[:\-]?\s*([^\n]+)/i
        );

    if (match) {

        return match[1]
            .trim()
            .replace(/[|]/g, "")
            .trim();
    }

    return "Not detected";
}


// =====================================================
// FIND MANUFACTURING DATE
// =====================================================

function extractManufacturingDate(text) {

    let match =
        text.match(
            /month\s*(?:&|and)\s*year\s*of\s*mfg\.?\s*[:\-]?\s*([0-9]{1,2}[\/\-][0-9]{4})/i
        );

    if (match) {

        return match[1];
    }


    // Backup pattern
    match =
        text.match(
            /(?:mfg|manufacturing|manufactured)\s*(?:date)?\s*[:\-]?\s*([0-9]{1,2}[\/\-][0-9]{4})/i
        );

    if (match) {

        return match[1];
    }

    return "Not detected";
}


// =====================================================
// FIND CONSUMER CARE
// =====================================================

function detectConsumerCare(text) {

    const lower =
        text.toLowerCase();

    const hasConsumer =
        lower.includes("consumer");

    const hasCustomer =
        lower.includes("customer");

    const hasComplaint =
        lower.includes("complaint");

    const hasPhone =
        /\b\d{3,5}\s?\d{3}\s?\d{3,5}\b/.test(text);

    const hasEmail =
        /[\w.-]+@[\w.-]+\.\w+/.test(text);


    if (
        hasConsumer ||
        hasCustomer ||
        hasComplaint ||
        hasPhone ||
        hasEmail
    ) {

        return "Detected";
    }

    return "Not detected";
}


// =====================================================
// ANALYZE PRODUCT
// =====================================================

async function analyzeProduct() {

    const file =
        imageInput.files[0];

    if (!file) {

        alert(
            "Please upload a product image first."
        );

        return;
    }


    // Existing HTML elements

    const productName =
        document.getElementById(
            "productName"
        );

    const netQuantity =
        document.getElementById(
            "netQuantity"
        );

    const mrp =
        document.getElementById(
            "mrp"
        );

    const manufacturer =
        document.getElementById(
            "manufacturer"
        );

    const complianceStatus =
        document.getElementById(
            "complianceStatus"
        );

    const complianceMessage =
        document.getElementById(
            "complianceMessage"
        );

    const ocrText =
        document.getElementById(
            "ocrText"
        );


    // Processing message

    complianceStatus.textContent =
        "Analyzing product...";

    complianceMessage.textContent =
        "Enhancing image and scanning package declarations. Please wait.";

    productName.textContent =
        "Scanning...";

    netQuantity.textContent =
        "Scanning...";

    mrp.textContent =
        "Scanning...";

    manufacturer.textContent =
        "Scanning...";

    ocrText.textContent =
        "Running multi-pass OCR...";


    document
        .getElementById(
            "resultSection"
        )
        .scrollIntoView({
            behavior: "smooth"
        });


    try {

        // =================================================
        // CREATE ENHANCED IMAGES
        // =================================================

        const fullImage =
            await preprocessImage(file);

        const declarationImage =
            await createDeclarationCrop(file);


        // =================================================
        // CREATE OCR WORKER
        // =================================================

        const worker =
            await Tesseract.createWorker(
                "eng"
            );


        // =================================================
        // OCR PASS 1 - FULL IMAGE
        // =================================================

        const fullResult =
            await worker.recognize(
                fullImage
            );

        const fullText =
            fullResult.data.text;


        // =================================================
        // OCR PASS 2 - DECLARATION SECTION
        // =================================================

        const declarationResult =
            await worker.recognize(
                declarationImage
            );

        const declarationText =
            declarationResult.data.text;


        // =================================================
        // COMBINE OCR RESULTS
        // =================================================

        const combinedText =
            cleanOCRText(
                fullText +
                "\n" +
                declarationText
            );


        console.log(
            "FULL OCR:",
            fullText
        );

        console.log(
            "DECLARATION OCR:",
            declarationText
        );

        console.log(
            "COMBINED OCR:",
            combinedText
        );


        // Display OCR
        ocrText.textContent =
            combinedText ||
            "No text detected.";


        // =================================================
        // EXTRACT DECLARATIONS
        // =================================================

        const commodity =
            extractCommodity(
                combinedText
            );

        const quantity =
            extractQuantity(
                combinedText
            );

        const detectedMRP =
            extractMRP(
                combinedText
            );

        const detectedManufacturer =
            extractManufacturer(
                combinedText
            );

        const marketedBy =
            extractMarketedBy(
                combinedText
            );

        const country =
            extractCountry(
                combinedText
            );

        const manufacturingDate =
            extractManufacturingDate(
                combinedText
            );

        const consumerCare =
            detectConsumerCare(
                combinedText
            );


        // =================================================
        // DISPLAY MAIN INFORMATION
        // =================================================

        // Use Commodity as product name
        if (
            commodity !==
            "Not detected"
        ) {

            productName.textContent =
                commodity;

        } else {

            productName.textContent =
                "Not detected";
        }


        netQuantity.textContent =
            quantity;

        mrp.textContent =
            detectedMRP;

        manufacturer.textContent =
            detectedManufacturer;


        // =================================================
        // COMPLIANCE CHECK
        // =================================================

        let detectedItems = 0;

        let missingItems = [];


        if (
            commodity !==
            "Not detected"
        ) {

            detectedItems++;

        } else {

            missingItems.push(
                "Commodity / common name"
            );
        }


        if (
            quantity !==
            "Not detected"
        ) {

            detectedItems++;

        } else {

            missingItems.push(
                "Net quantity"
            );
        }


        if (
            detectedMRP !==
            "Not detected"
        ) {

            detectedItems++;

        } else {

            missingItems.push(
                "MRP"
            );
        }


        if (
            detectedManufacturer !==
            "Not detected"
        ) {

            detectedItems++;

        } else {

            missingItems.push(
                "Manufacturer information"
            );
        }


        if (
            country !==
            "Not detected"
        ) {

            detectedItems++;

        }


        if (
            manufacturingDate !==
            "Not detected"
        ) {

            detectedItems++;

        } else {

            missingItems.push(
                "Manufacturing date"
            );
        }


        if (
            consumerCare ===
            "Detected"
        ) {

            detectedItems++;

        } else {

            missingItems.push(
                "Consumer care details"
            );
        }


        // =================================================
        // FINAL RESULT
        // =================================================

        if (
            missingItems.length === 0
        ) {

            complianceStatus.textContent =
                "Potentially Compliant";

            complianceMessage.textContent =
                "Key package declarations were detected by the AI-assisted screening system. Human verification is recommended.";

        } else {

            complianceStatus.textContent =
                "Potential Non-Compliance";

            complianceMessage.textContent =
                detectedItems +
                " key declarations detected. " +
                "Not detected: " +
                missingItems.join(", ") +
                ". Human verification is recommended.";
        }


        // =================================================
        // ADD EXTRA DETAILS TO OCR SECTION
        // =================================================

        ocrText.textContent =
            "Detected Declaration Summary\n\n" +

            "Commodity: " +
            commodity +

            "\nNet Quantity: " +
            quantity +

            "\nMRP: " +
            detectedMRP +

            "\nManufactured by: " +
            detectedManufacturer +

            "\nMarketed by: " +
            marketedBy +

            "\nCountry of Origin: " +
            country +

            "\nManufacturing Date: " +
            manufacturingDate +

            "\nConsumer Care: " +
            consumerCare +

            "\n\n-----------------------------\n" +

            "Raw OCR Text\n\n" +

            combinedText;


        // Stop OCR
        await worker.terminate();


    } catch (error) {

        console.error(error);


        complianceStatus.textContent =
            "Analysis Failed";

        complianceMessage.textContent =
            "The image could not be processed. Please upload a clear product-label photograph.";

        ocrText.textContent =
            "OCR error: " +
            error.message;
    }
}
