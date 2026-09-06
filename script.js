const imageInput = document.getElementById("productImage");
const imagePreview = document.getElementById("imagePreview");


// ======================================================
// SHOW UPLOADED IMAGE
// ======================================================

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


// ======================================================
// NORMALIZE OCR TEXT
// ======================================================

function normalizeOCRText(text) {

    return text
        .replace(/\r/g, "")
        .replace(/[|]/g, "I")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[₹]/g, "Rs ")
        .replace(/\s+/g, " ")
        .trim();
}


// ======================================================
// GET INDIVIDUAL LINES
// ======================================================

function getLines(text) {

    return text
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 1);
}


// ======================================================
// FIND LINE USING MULTIPLE OCR VARIATIONS
// ======================================================

function findMatchingLine(lines, patterns) {

    for (const line of lines) {

        const clean = line
            .toLowerCase()
            .replace(/[^a-z0-9₹.\-:/ ]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        for (const pattern of patterns) {

            if (clean.includes(pattern)) {
                return line;
            }
        }
    }

    return null;
}


// ======================================================
// EXTRACT MRP
// ======================================================

function extractMRP(text) {

    const lines = getLines(text);

    // Look specifically for lines containing MRP
    const mrpKeywords = [
        "maximum retail price",
        "maximum retail",
        "retail price",
        "mrp",
        "m.r.p"
    ];

    for (const line of lines) {

        const lower = line
            .toLowerCase()
            .replace(/\s+/g, " ");

        const containsMRP =
            mrpKeywords.some(keyword =>
                lower.includes(keyword)
            );

        if (!containsMRP) {
            continue;
        }

        /*
         * Look for a price after MRP wording.
         *
         * Examples:
         * MRP ₹149.00
         * MRP Rs.149.00
         * Maximum Retail Price: 149.00
         * Maximum Retail Price Rs 149.00
         */

        const priceMatches = line.match(
            /(?:₹|rs\.?|inr)?\s*(\d{1,6}(?:[.,]\d{1,2})?)/gi
        );

        if (priceMatches && priceMatches.length > 0) {

            // Take the LAST number on the MRP line.
            // This avoids picking unrelated numbers before the price.
            const lastMatch =
                priceMatches[priceMatches.length - 1];

            const numberMatch =
                lastMatch.match(
                    /\d{1,6}(?:[.,]\d{1,2})?/
                );

            if (numberMatch) {

                let value =
                    numberMatch[0].replace(",", ".");

                return "₹" + value;
            }
        }
    }


    // Backup search across the whole OCR text
    const backupMatch = text.match(
        /(?:mrp|maximum\s+retail\s+price|retail\s+price)[^0-9]{0,30}(\d{1,6}(?:[.,]\d{1,2})?)/i
    );

    if (backupMatch) {

        return "₹" +
            backupMatch[1].replace(",", ".");
    }

    return "Not detected";
}


// ======================================================
// EXTRACT NET QUANTITY
// ======================================================

function extractQuantity(text) {

    const patterns = [

        /(?:net\s*(?:quantity|qty|wt|weight))[^0-9]{0,15}(\d+(?:\.\d+)?\s*(?:kg|kgs|g|gm|mg|ml|l|ltr|litre|liter|units?|nos?))/i,

        /(\d+(?:\.\d+)?\s*(?:kg|kgs|g|gm|mg|ml|l|ltr|litre|liter))/i,

        /(\d+\s*(?:u|units?|nos?))/i
    ];

    for (const pattern of patterns) {

        const match = text.match(pattern);

        if (match) {
            return match[1].trim();
        }
    }

    return "Not detected";
}


// ======================================================
// EXTRACT MANUFACTURER
// ======================================================

function extractManufacturer(text) {

    const lines = getLines(text);

    for (let i = 0; i < lines.length; i++) {

        const line = lines[i];

        const clean = line
            .toLowerCase()
            .replace(/[^a-z0-9 ]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        if (
            clean.includes("manufactured by") ||
            clean.includes("manufacturedby") ||
            clean.includes("mfd by") ||
            clean.includes("mfg by") ||
            clean.includes("manufacturer")
        ) {

            let result = line;

            // Remove the label itself
            result = result.replace(
                /manufactured\s*by\s*[:\-]?/i,
                ""
            );

            result = result.replace(
                /mfd\.?\s*by\s*[:\-]?/i,
                ""
            );

            result = result.replace(
                /mfg\.?\s*by\s*[:\-]?/i,
                ""
            );

            result = result.replace(
                /manufacturer\s*[:\-]?/i,
                ""
            );

            result = result.trim();

            // If OCR put the company on the next line,
            // add that line too.
            if (
                result.length < 8 &&
                lines[i + 1]
            ) {
                result += " " + lines[i + 1];
            }

            if (result.length > 2) {
                return result;
            }
        }
    }

    return "Not detected";
}


// ======================================================
// EXTRACT MARKETED BY
// ======================================================

function extractMarketedBy(text) {

    const lines = getLines(text);

    for (let i = 0; i < lines.length; i++) {

        const line = lines[i];

        const clean = line
            .toLowerCase()
            .replace(/[^a-z0-9 ]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        /*
         * Handles:
         *
         * Marketed by
         * Marketedby
         * Marketed By:
         * Marketed  by
         */

        if (
            clean.includes("marketed by") ||
            clean.includes("marketedby")
        ) {

            let result = line;

            result = result.replace(
                /marketed\s*by\s*[:\-]?/i,
                ""
            );

            result = result.trim();

            if (
                result.length < 5 &&
                lines[i + 1]
            ) {
                result += " " + lines[i + 1];
            }

            if (result.length > 2) {
                return result;
            }
        }
    }

    return "Not detected";
}


// ======================================================
// EXTRACT COUNTRY OF ORIGIN
// ======================================================

function extractCountry(text) {

    const match = text.match(
        /country\s+of\s+origin\s*[:\-]?\s*([A-Za-z ]+)/i
    );

    if (match) {

        return match[1]
            .replace(/\s+/g, " ")
            .trim();
    }

    // Common OCR-friendly fallback
    if (/\bmade\s+in\s+india\b/i.test(text)) {
        return "INDIA";
    }

    if (/\bindia\b/i.test(text)) {
        return "INDIA";
    }

    return "Not detected";
}


// ======================================================
// EXTRACT MANUFACTURING DATE
// ======================================================

function extractManufacturingDate(text) {

    const patterns = [

        /month\s*(?:and|&)?\s*year\s*(?:of)?\s*mfg[^0-9]*(\d{1,2}[\/\-]\d{4})/i,

        /month\s*(?:and|&)?\s*year\s*(?:of)?\s*manufactur[^0-9]*(\d{1,2}[\/\-]\d{4})/i,

        /mfg[^0-9]*(\d{1,2}[\/\-]\d{4})/i,

        /manufactur[^0-9]*(\d{1,2}[\/\-]\d{4})/i
    ];

    for (const pattern of patterns) {

        const match = text.match(pattern);

        if (match) {
            return match[1];
        }
    }

    return "Not detected";
}


// ======================================================
// EXTRACT CONSUMER CARE
// ======================================================

function extractConsumerCare(text) {

    const lower = text.toLowerCase();

    const keywords = [
        "consumer care",
        "customer care",
        "consumer complaints",
        "customer complaints",
        "toll free",
        "helpline",
        "contact us",
        "email",
        "@"
    ];

    for (const keyword of keywords) {

        if (lower.includes(keyword)) {
            return "Detected";
        }
    }

    // Phone number fallback
    const phoneMatch =
        text.match(/\b\d{3,5}[\s\-]?\d{5,8}\b/);

    if (phoneMatch) {
        return "Detected";
    }

    return "Not detected";
}


// ======================================================
// EXTRACT COMMON / COMMODITY NAME
// ======================================================

function extractCommodity(text) {

    const patterns = [

        /commodity\s*[:\-]\s*(.+)/i,

        /common\s+name\s*[:\-]\s*(.+)/i,

        /generic\s+name\s*[:\-]\s*(.+)/i
    ];

    for (const pattern of patterns) {

        const match = text.match(pattern);

        if (match) {
            return match[1].trim();
        }
    }

    // Fallback: first meaningful line
    const lines = getLines(text);

    for (const line of lines) {

        const clean = line
            .replace(/[^A-Za-z0-9 ]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        if (
            clean.length >= 3 &&
            clean.length <= 60 &&
            !/^(www|http|fsc|bis|iso|barcode)/i.test(clean)
        ) {
            return clean;
        }
    }

    return "Not detected";
}


// ======================================================
// CREATE CHECKLIST
// ======================================================

function createChecklist(data) {

    const checklist = [

        {
            name: "Commodity / Common Name",
            value: data.commodity,
            mandatory: true
        },

        {
            name: "Net Quantity",
            value: data.quantity,
            mandatory: true
        },

        {
            name: "Maximum Retail Price (MRP)",
            value: data.mrp,
            mandatory: true
        },

        {
            name: "Manufacturer / Packer / Importer",
            value: data.manufacturer,
            mandatory: true
        },

        {
            name: "Marketed By",
            value: data.marketedBy,
            mandatory: false
        },

        {
            name: "Country of Origin",
            value: data.country,
            mandatory: false
        },

        {
            name: "Month & Year of Manufacture",
            value: data.manufacturingDate,
            mandatory: true
        },

        {
            name: "Consumer Care Details",
            value: data.consumerCare,
            mandatory: true
        }
    ];


    let html = `
        <div class="declaration-checklist"
             style="
                margin-top:25px;
                padding:22px;
                border:1px solid #ddd;
                border-radius:14px;
                background:white;
             ">

            <h3 style="margin-top:0;">
                Declaration Checklist
            </h3>
    `;


    let missingMandatory = [];


    checklist.forEach(item => {

        const detected =
            item.value &&
            item.value !== "Not detected";

        let statusText;
        let statusColor;

        if (detected) {

            statusText = "✓ Detected";
            statusColor = "#138a4b";

        } else if (!item.mandatory) {

            statusText = "— Not assessed";
            statusColor = "#777";

        } else {

            statusText = "✗ Not Detected";
            statusColor = "#d93025";

            missingMandatory.push(item.name);
        }


        html += `
            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                padding:12px 0;
                border-bottom:1px solid #eee;
                gap:20px;
            ">

                <span>${item.name}</span>

                <span style="
                    color:${statusColor};
                    font-weight:600;
                    white-space:nowrap;
                ">
                    ${statusText}
                </span>

            </div>
        `;
    });


    html += `
            <p style="
                margin-top:18px;
                color:#666;
                font-size:14px;
            ">
                Screening result only. Human verification is recommended
                before taking regulatory action.
            </p>

        </div>
    `;


    return {
        html,
        missingMandatory
    };
}


// ======================================================
// ANALYZE PRODUCT
// ======================================================

async function analyzeProduct() {

    const file = imageInput.files[0];

    if (!file) {

        alert("Please upload a product image first.");
        return;
    }


    // Existing HTML elements
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
        "OCR is reading the product label. Please wait.";

    productName.textContent = "Scanning...";
    netQuantity.textContent = "Scanning...";
    mrp.textContent = "Scanning...";
    manufacturer.textContent = "Scanning...";

    ocrText.textContent =
        "OCR is processing the image...";


    document.getElementById("resultSection")
        .scrollIntoView({
            behavior: "smooth"
        });


    try {

        // Create OCR worker
        const worker =
            await Tesseract.createWorker("eng");


        // Use a label-friendly page segmentation mode
        await worker.setParameters({
            tessedit_pageseg_mode: "6"
        });


        // Perform OCR
        const result =
            await worker.recognize(file);


        const rawText =
            result.data.text || "";


        // Show raw OCR
        ocrText.textContent =
            rawText || "No text detected.";


        // Normalize for extraction
        const normalizedText =
            normalizeOCRText(rawText);


        // ==================================================
        // EXTRACT DECLARATIONS
        // ==================================================

        const commodity =
            extractCommodity(rawText);

        const quantity =
            extractQuantity(rawText);

        const detectedMRP =
            extractMRP(rawText);

        const detectedManufacturer =
            extractManufacturer(rawText);

        const marketedBy =
            extractMarketedBy(rawText);

        const country =
            extractCountry(rawText);

        const manufacturingDate =
            extractManufacturingDate(rawText);

        const consumerCare =
            extractConsumerCare(rawText);


        // ==================================================
        // UPDATE MAIN CARDS
        // ==================================================

        productName.textContent =
            commodity;

        netQuantity.textContent =
            quantity;

        mrp.textContent =
            detectedMRP;

        manufacturer.textContent =
            detectedManufacturer;


        // ==================================================
        // STRUCTURED DECLARATION SUMMARY
        // ==================================================

        const declarationSummary = `

STRUCTURED DECLARATION DATA

Commodity: ${commodity}

Net Quantity: ${quantity}

MRP: ${detectedMRP}

Manufacturer: ${detectedManufacturer}

Marketed By: ${marketedBy}

Country of Origin: ${country}

Manufacturing Date: ${manufacturingDate}

Consumer Care: ${consumerCare}


--------------------------------

RAW OCR OUTPUT

${rawText}
        `;


        ocrText.textContent =
            declarationSummary;


        // ==================================================
        // CREATE CHECKLIST
        // ==================================================

        const checklistResult =
            createChecklist({

                commodity,
                quantity,
                mrp: detectedMRP,
                manufacturer: detectedManufacturer,
                marketedBy,
                country,
                manufacturingDate,
                consumerCare
            });


        // Remove old checklist
        const oldChecklist =
            document.querySelector(
                ".declaration-checklist"
            );

        if (oldChecklist) {
            oldChecklist.remove();
        }


        // Add checklist after OCR section
        const ocrContainer =
            ocrText.parentElement;

        ocrContainer.insertAdjacentHTML(
            "afterend",
            checklistResult.html
        );


        // ==================================================
        // COMPLIANCE RESULT
        // ==================================================

        const missing =
            checklistResult.missingMandatory;


        if (missing.length === 0) {

            complianceStatus.textContent =
                "Potentially Compliant";

            complianceMessage.textContent =
                "All key declarations in the screening checklist were detected. Human verification is recommended.";

        } else {

            complianceStatus.textContent =
                "Potential Non-Compliance";

            complianceMessage.textContent =
                "The following mandatory declaration(s) could not be detected: " +
                missing.join(", ") +
                ". Human verification is recommended.";
        }


        // Stop worker
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
