const imageInput = document.getElementById("productImage");
const imagePreview = document.getElementById("imagePreview");


// =====================================================
// SHOW IMAGE PREVIEW
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

            // Increase resolution
            const scale = 2;

            const canvas = document.createElement("canvas");

            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            const ctx = canvas.getContext("2d");

            // Draw enlarged image
            ctx.drawImage(
                img,
                0,
                0,
                canvas.width,
                canvas.height
            );

            // Get pixels
            const imageData = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
            );

            const data = imageData.data;

            // Grayscale + contrast enhancement
            for (let i = 0; i < data.length; i += 4) {

                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Grayscale
                let gray =
                    0.299 * r +
                    0.587 * g +
                    0.114 * b;

                // Increase contrast
                gray = ((gray - 128) * 1.35) + 128;

                gray = Math.max(0, Math.min(255, gray));

                data[i] = gray;
                data[i + 1] = gray;
                data[i + 2] = gray;
            }

            ctx.putImageData(imageData, 0, 0);

            resolve(canvas);
        };

        img.onerror = reject;

        img.src = URL.createObjectURL(file);
    });
}


// =====================================================
// NORMALIZE OCR TEXT
// =====================================================

function normalizeText(text) {

    return text
        .replace(/\r/g, "")
        .replace(/[|]/g, "I")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}


// =====================================================
// FIND LINE AFTER LABEL
// =====================================================

function findLabelValue(text, labels) {

    const lines = text
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);

    for (let i = 0; i < lines.length; i++) {

        const line = lines[i];

        for (const label of labels) {

            const regex = new RegExp(
                label + "\\s*[:\\-]?\\s*(.*)",
                "i"
            );

            const match = line.match(regex);

            if (match) {

                let value = match[1].trim();

                // If value is empty, use next line
                if (!value && lines[i + 1]) {
                    value = lines[i + 1].trim();
                }

                if (value.length > 1) {
                    return value;
                }
            }
        }
    }

    return null;
}


// =====================================================
// PRODUCT / COMMODITY
// =====================================================

function detectProduct(text) {

    let value = findLabelValue(text, [
        "commodity",
        "common name",
        "product name"
    ]);

    if (value) {
        return cleanValue(value);
    }

    return "Not detected";
}


// =====================================================
// NET QUANTITY
// =====================================================

function detectQuantity(text) {

    // Examples:
    // 1U
    // 1 U
    // 500 g
    // 250 ml
    // 1 kg
    // 2 L

    const patterns = [

        /net\s*quantity\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(u|unit|units|kg|g|mg|ml|l|litre|liter|nos?)/i,

        /net\s*quantity\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(u|unit|units)/i,

        /(\d+(?:\.\d+)?)\s*(kg|g|mg|ml|l|litre|liter)\b/i,

        /\b(\d+)\s*U\b/i
    ];

    for (const pattern of patterns) {

        const match = text.match(pattern);

        if (match) {

            let number = match[1];
            let unit = match[2];

            if (!unit) {
                return number;
            }

            unit = unit.toUpperCase();

            if (unit === "UNIT" || unit === "UNITS") {
                unit = "U";
            }

            if (unit === "LITRE" || unit === "LITER") {
                unit = "L";
            }

            return `${number} ${unit}`;
        }
    }

    return "Not detected";
}


// =====================================================
// MRP
// =====================================================

function detectMRP(text) {

    const patterns = [

        // MRP ₹149
        /(?:MRP|M\.R\.P\.?)\s*[:\-]?\s*[₹Rs\.]*\s*(\d+(?:\.\d{1,2})?)/i,

        // Maximum Retail Price ₹149
        /maximum\s*retail\s*price\s*[:\-]?\s*[₹Rs\.]*\s*(\d+(?:\.\d{1,2})?)/i,

        // Maximum Retail Price: T 149.00
        /maximum\s*retail\s*price[^0-9]{0,15}(\d+(?:\.\d{1,2})?)/i,

        // MRP ... 149
        /\bMRP\b[^0-9]{0,20}(\d+(?:\.\d{1,2})?)/i
    ];

    for (const pattern of patterns) {

        const match = text.match(pattern);

        if (match) {
            return "₹" + parseFloat(match[1]).toFixed(2);
        }
    }

    return "Not detected";
}


// =====================================================
// MANUFACTURER
// =====================================================

function detectManufacturer(text) {

    const value = findLabelValue(text, [
        "manufactured by",
        "manufactured",
        "mfd by",
        "manufacturer"
    ]);

    if (value) {

        return cleanCompanyName(value);
    }

    return "Not detected";
}


// =====================================================
// MARKETER
// =====================================================

function detectMarketer(text) {

    const value = findLabelValue(text, [
        "marketed by",
        "marketed"
    ]);

    if (value) {
        return cleanCompanyName(value);
    }

    return "Not detected";
}


// =====================================================
// COUNTRY OF ORIGIN
// =====================================================

function detectCountry(text) {

    const value = findLabelValue(text, [
        "country of origin",
        "country"
    ]);

    if (value) {

        if (/india/i.test(value)) {
            return "INDIA";
        }

        return cleanValue(value);
    }

    // Search anywhere in OCR
    if (/\bindia\b/i.test(text)) {
        return "INDIA";
    }

    return "Not detected";
}


// =====================================================
// MANUFACTURING DATE
// =====================================================

function detectManufacturingDate(text) {

    const patterns = [

        /month\s*(?:&|and)?\s*year\s*of\s*mfg\.?\s*[:\-]?\s*(\d{1,2}[\/\-]\d{4})/i,

        /month\s*(?:&|and)?\s*year\s*of\s*manufactur[a-z]*\s*[:\-]?\s*(\d{1,2}[\/\-]\d{4})/i,

        /(?:mfg|manufacturing|manufactured|packed)\s*(?:date)?\s*[:\-]?\s*(\d{1,2}[\/\-]\d{4})/i,

        /\b(\d{1,2}[\/\-]\d{4})\b/
    ];

    for (const pattern of patterns) {

        const match = text.match(pattern);

        if (match) {
            return match[1];
        }
    }

    return "Not detected";
}


// =====================================================
// CONSUMER CARE
// =====================================================

function detectConsumerCare(text) {

    const patterns = [

        /consumer\s*care/i,

        /customer\s*care/i,

        /toll\s*free/i,

        /\b1[0-9]{9}\b/,

        /\b1800[\s\-]?\d{3}[\s\-]?\d{4}\b/i,

        /@[a-z0-9.-]+\.[a-z]{2,}/i
    ];

    for (const pattern of patterns) {

        if (pattern.test(text)) {
            return "Detected";
        }
    }

    return "Not detected";
}


// =====================================================
// CLEAN VALUES
// =====================================================

function cleanValue(value) {

    return value
        .replace(/[|]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 150);
}


function cleanCompanyName(value) {

    return value
        .replace(/[|]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 150);
}


// =====================================================
// CREATE CLEAN DECLARATION SUMMARY
// =====================================================

function createDeclarationSummary(data) {

    return `
        <strong>Detected Declaration Summary</strong>
        <br><br>

        Commodity: ${data.product}
        <br>
        Net Quantity: ${data.quantity}
        <br>
        MRP: ${data.mrp}
        <br>
        Manufactured by: ${data.manufacturer}
        <br>
        Marketed by: ${data.marketer}
        <br>
        Country of Origin: ${data.country}
        <br>
        Manufacturing Date: ${data.manufacturingDate}
        <br>
        Consumer Care: ${data.consumerCare}
        <br><br>

        <strong>Raw OCR text is used internally for analysis.</strong>
    `;
}


// =====================================================
// ANALYZE PRODUCT
// =====================================================

async function analyzeProduct() {

    const file = imageInput.files[0];

    if (!file) {

        alert("Please upload a product image first.");

        return;
    }


    // Get result elements

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


    // Processing message

    complianceStatus.textContent =
        "Analyzing product...";

    complianceMessage.textContent =
        "Enhancing image and extracting package declarations...";

    productName.textContent = "Scanning...";
    netQuantity.textContent = "Scanning...";
    mrp.textContent = "Scanning...";
    manufacturer.textContent = "Scanning...";

    ocrText.innerHTML =
        "Analyzing product label...";


    document
        .getElementById("resultSection")
        .scrollIntoView({
            behavior: "smooth"
        });


    try {

        // =============================================
        // PREPROCESS IMAGE
        // =============================================

        const processedImage =
            await preprocessImage(file);


        // =============================================
        // OCR WORKER
        // =============================================

        const worker =
            await Tesseract.createWorker("eng");


        // Page segmentation mode 6:
        // Assume a uniform block of text

        await worker.setParameters({
            tessedit_pageseg_mode: "6"
        });


        // =============================================
        // RUN OCR
        // =============================================

        const result =
            await worker.recognize(processedImage);


        let text =
            result.data.text || "";


        text = normalizeText(text);


        console.log("OCR RESULT:");
        console.log(text);


        // =============================================
        // EXTRACT INFORMATION
        // =============================================

        const data = {

            product:
                detectProduct(text),

            quantity:
                detectQuantity(text),

            mrp:
                detectMRP(text),

            manufacturer:
                detectManufacturer(text),

            marketer:
                detectMarketer(text),

            country:
                detectCountry(text),

            manufacturingDate:
                detectManufacturingDate(text),

            consumerCare:
                detectConsumerCare(text)
        };


        console.log("DETECTED DATA:");
        console.log(data);


        // =============================================
        // SHOW MAIN RESULTS
        // =============================================

        productName.textContent =
            data.product;

        netQuantity.textContent =
            data.quantity;

        mrp.textContent =
            data.mrp;

        manufacturer.textContent =
            data.manufacturer;


        // =============================================
        // SHOW CLEAN SUMMARY
        // =============================================

        ocrText.innerHTML =
            createDeclarationSummary(data);


        // =============================================
        // COMPLIANCE CHECK
        // =============================================

        let detectedCount = 0;

        if (data.product !== "Not detected")
            detectedCount++;

        if (data.quantity !== "Not detected")
            detectedCount++;

        if (data.mrp !== "Not detected")
            detectedCount++;

        if (data.manufacturer !== "Not detected")
            detectedCount++;

        if (data.marketer !== "Not detected")
            detectedCount++;

        if (data.country !== "Not detected")
            detectedCount++;

        if (data.manufacturingDate !== "Not detected")
            detectedCount++;

        if (data.consumerCare !== "Not detected")
            detectedCount++;


        // =============================================
        // FINAL STATUS
        // =============================================

        if (detectedCount >= 6) {

            complianceStatus.textContent =
                "Potentially Compliant";

            complianceMessage.textContent =
                `${detectedCount} key declarations were detected from the package label. Human verification is recommended.`;

        }

        else {

            complianceStatus.textContent =
                "Potential Non-Compliance";

            complianceMessage.textContent =
                `${detectedCount} key declarations were detected. Some declarations could not be detected by OCR. Human verification is recommended.`;
        }


        // Stop OCR

        await worker.terminate();


    }

    catch (error) {

        console.error(error);

        complianceStatus.textContent =
            "Analysis Failed";

        complianceMessage.textContent =
            "The image could not be processed. Please upload a clear, well-lit product label.";

        ocrText.textContent =
            "OCR error: " + error.message;
    }
}
