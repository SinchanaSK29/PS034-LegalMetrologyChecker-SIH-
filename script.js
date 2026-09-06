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
// OCR TEXT HELPERS
// ======================================================

function getLines(text) {

    return text
        .replace(/\r/g, "")
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 1);
}


function cleanSpaces(text) {

    return text
        .replace(/\s+/g, " ")
        .trim();
}


// ======================================================
// EXTRACT MRP
// ======================================================

function extractMRP(text) {

    const lines = getLines(text);

    for (const line of lines) {

        const lower = line
            .toLowerCase()
            .replace(/\s+/g, " ");

        if (
            !lower.includes("maximum retail price") &&
            !lower.includes("maximum retail") &&
            !lower.includes("retail price") &&
            !/\bmrp\b/i.test(line)
        ) {
            continue;
        }

        // Example:
        // Maximum Retail Price: I 149.00 3
        //
        // We want 149.00, not the final OCR "3".

        const decimalMatches = line.match(
            /\b\d{1,6}[.,]\d{2}\b/g
        );

        if (decimalMatches && decimalMatches.length > 0) {

            const value = decimalMatches[0]
                .replace(",", ".");

            return "₹" + value;
        }

        // Backup if OCR does not contain decimals.

        const afterMRP = line.match(
            /(?:mrp|maximum\s+retail\s+price|maximum\s+retail|retail\s+price)[^0-9]{0,30}(\d{1,6})/i
        );

        if (afterMRP) {
            return "₹" + afterMRP[1];
        }
    }

    return "Not detected";
}


// ======================================================
// EXTRACT NET QUANTITY
// ======================================================

function extractQuantity(text) {

    const lines = getLines(text);

    // IMPORTANT:
    // Only inspect the line containing Net Quantity.
    // This prevents unrelated OCR numbers from being selected.

    for (const line of lines) {

        if (!/net\s*(?:quantity|qty)/i.test(line)) {
            continue;
        }

        // Normal units:
        // 500 g
        // 1 kg
        // 250 ml
        // 2 l

        const unitMatch = line.match(
            /(\d+(?:\.\d+)?)\s*(kg|kgs|g|gm|mg|ml|l|ltr|litre|liter)\b/i
        );

        if (unitMatch) {

            return cleanSpaces(
                unitMatch[1] + " " + unitMatch[2]
            );
        }

        // OCR commonly reads "1U" for one unit.

        const countMatch = line.match(
            /(\d+)\s*(u|units?|nos?|pcs?|pieces?)\b/i
        );

        if (countMatch) {

            return (
                countMatch[1] +
                " " +
                countMatch[2].toUpperCase()
            );
        }

        // Very OCR-friendly fallback:
        // Net Quantity: 1U

        const simpleMatch = line.match(
            /net\s*(?:quantity|qty)[^0-9]{0,20}(\d+)/i
        );

        if (simpleMatch) {

            return simpleMatch[1] + " U";
        }
    }

    return "Not detected";
}


// ======================================================
// EXTRACT COMMODITY / COMMON NAME
// ======================================================

function extractCommodity(text) {

    const lines = getLines(text);

    for (const line of lines) {

        if (
            /commodity/i.test(line) ||
            /common\s+name/i.test(line) ||
            /generic\s+name/i.test(line)
        ) {

            let result = line;

            // Remove everything before the declaration label.

            result = result.replace(
                /.*?commodity\s*[:\-]?\s*/i,
                ""
            );

            result = result.replace(
                /.*?common\s+name\s*[:\-]?\s*/i,
                ""
            );

            result = result.replace(
                /.*?generic\s+name\s*[:\-]?\s*/i,
                ""
            );

            result = cleanSpaces(result);

            // Remove OCR separators and everything after them.

            result = result
                .split("|")[0]
                .trim();

            // Remove obvious OCR garbage at the end.
            // Example: "Toy EER"

            result = result
                .replace(/\s+(EER|ERR|EEE|I|II|III)$/i, "")
                .trim();

            // Remove short all-capital OCR garbage at the end.
            // Example: "Toy EER"

            result = result
                .replace(/\s+[A-Z]{2,5}$/g, "")
                .trim();

            if (result.length > 0) {
                return result;
            }
        }
    }

    return "Not detected";
}


// ======================================================
// EXTRACT MANUFACTURER
// ======================================================

function extractManufacturer(text) {

    const lines = getLines(text);

    for (const line of lines) {

        if (
            !/manufactured\s*by/i.test(line) &&
            !/mfd\.?\s*by/i.test(line) &&
            !/mfg\.?\s*by/i.test(line) &&
            !/manufacturer/i.test(line)
        ) {
            continue;
        }

        let result = line;

        // Remove OCR content before the actual label.

        result = result.replace(
            /.*?manufactured\s*by\s*[:\-]?\s*/i,
            ""
        );

        result = result.replace(
            /.*?mfd\.?\s*by\s*[:\-]?\s*/i,
            ""
        );

        result = result.replace(
            /.*?mfg\.?\s*by\s*[:\-]?\s*/i,
            ""
        );

        result = result.replace(
            /.*?manufacturer\s*[:\-]?\s*/i,
            ""
        );

        result = cleanSpaces(result);

        // Remove trailing OCR numbers.
        // Example:
        // PARKSONS CARTAMUNDI PVT.LTD. 2 3

        result = result.replace(
            /\s+\d+(?:\s+\d+)*\s*$/,
            ""
        );

        // Remove trailing OCR punctuation.

        result = result
            .replace(/[\s|]+$/g, "")
            .trim();

        if (result.length > 2) {
            return result;
        }
    }

    return "Not detected";
}


// ======================================================
// EXTRACT MARKETED BY
// ======================================================

function extractMarketedBy(text) {

    const lines = getLines(text);

    for (const line of lines) {

        if (!/marketed\s*by/i.test(line)) {
            continue;
        }

        let result = line;

        result = result.replace(
            /.*?marketed\s*by\s*[:\-]?\s*/i,
            ""
        );

        result = cleanSpaces(result);

        // Remove trailing OCR garbage.

        result = result
            .replace(/\s+[eE]\s*$/g, "")
            .replace(/\s+[|Il1]+\s*$/g, "")
            .trim();

        if (result.length > 2) {
            return result;
        }
    }

    return "Not detected";
}


// ======================================================
// EXTRACT COUNTRY
// ======================================================

function extractCountry(text) {

    const lines = getLines(text);

    for (const line of lines) {

        const match = line.match(
            /country\s+of\s+origin\s*[:\-]?\s*(.+)/i
        );

        if (match) {

            let result = match[1]
                .replace(/[^A-Za-z ]/g, " ")
                .replace(/\s+/g, " ")
                .trim();

            if (/india/i.test(result)) {
                return "INDIA";
            }

            if (result.length > 0) {
                return result;
            }
        }
    }

    // Backup.

    if (/\bmade\s+in\s+india\b/i.test(text)) {
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

    // Phone number fallback.

    const phoneMatch =
        text.match(/\b\d{3,5}[\s\-]?\d{5,8}\b/);

    if (phoneMatch) {
        return "Detected";
    }

    return "Not detected";
}


// ======================================================
// CREATE DECLARATION CHECKLIST
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

            <h3 style="
                margin-top:0;
                margin-bottom:18px;
            ">
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

                <span>
                    ${item.name}
                </span>

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

        alert(
            "Please upload a product image first."
        );

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

    productName.textContent =
        "Scanning...";

    netQuantity.textContent =
        "Scanning...";

    mrp.textContent =
        "Scanning...";

    manufacturer.textContent =
        "Scanning...";

    ocrText.textContent =
        "OCR is processing the image...";


    document.getElementById("resultSection")
        .scrollIntoView({
            behavior: "smooth"
        });


    let worker = null;


    try {

        // ==================================================
        // CREATE OCR WORKER
        // ==================================================

        worker =
            await Tesseract.createWorker("eng");


        await worker.setParameters({
            tessedit_pageseg_mode: "6"
        });


        // ==================================================
        // OCR
        // ==================================================

        const result =
            await worker.recognize(file);


        const rawText =
            result.data.text || "";


        if (!rawText.trim()) {

            throw new Error(
                "No readable text was detected."
            );
        }


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
`;

ocrText.textContent = declarationSummary;
        



        // ==================================================
        // CREATE CHECKLIST
        // ==================================================

        const checklistResult =
            createChecklist({

                commodity,

                quantity,

                mrp: detectedMRP,

                manufacturer:
                    detectedManufacturer,

                marketedBy,

                country,

                manufacturingDate,

                consumerCare
            });


        // ==================================================
        // REMOVE OLD CHECKLIST
        // ==================================================

        const oldChecklist =
            document.querySelector(
                ".declaration-checklist"
            );


        if (oldChecklist) {
            oldChecklist.remove();
        }


        // ==================================================
        // ADD CHECKLIST BELOW OCR
        // ==================================================

        ocrText.insertAdjacentHTML(
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


    } catch (error) {

        console.error(error);

        complianceStatus.textContent =
            "Analysis Failed";

        complianceMessage.textContent =
            "OCR could not process this image. Please try a clearer product label image.";

        ocrText.textContent =
            "OCR error: " + error.message;

    } finally {

        // Always stop the OCR worker.

        if (worker) {
            try {
                await worker.terminate();
            } catch (terminateError) {
                console.error(
                    "Worker termination error:",
                    terminateError
                );
            }
        }
    }
}
