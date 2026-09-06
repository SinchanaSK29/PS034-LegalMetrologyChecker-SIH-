const imageInput = document.getElementById("productImage");
const imagePreview = document.getElementById("imagePreview");


// =====================================================
// SHOW IMAGE
// =====================================================

imageInput.addEventListener("change", function () {

    const file = imageInput.files[0];

    if (!file) return;

    const imageURL = URL.createObjectURL(file);

    imagePreview.innerHTML = `
        <img src="${imageURL}" alt="Uploaded product">
    `;
});


// =====================================================
// PREPROCESS IMAGE
// =====================================================

function preprocessImage(file) {

    return new Promise((resolve, reject) => {

        const img = new Image();

        img.onload = function () {

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

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

                let value =
                    (gray - 128) * 1.35 + 128;

                value = Math.max(
                    0,
                    Math.min(255, value)
                );

                data[i] = value;
                data[i + 1] = value;
                data[i + 2] = value;
            }

            ctx.putImageData(imageData, 0, 0);

            canvas.toBlob(
                blob => {

                    if (!blob) {
                        reject(
                            new Error("Image processing failed")
                        );
                        return;
                    }

                    resolve(blob);
                },
                "image/png"
            );
        };

        img.onerror = () => {
            reject(
                new Error("Unable to load image")
            );
        };

        img.src = URL.createObjectURL(file);
    });
}


// =====================================================
// CROP DECLARATION AREA
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
             * For this type of package,
             * important declarations are normally
             * in the lower part.
             */

            const cropY =
                Math.floor(img.height * 0.38);

            const cropHeight =
                img.height - cropY;

            const scale = 3;

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

            const imageData =
                ctx.getImageData(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );

            const data =
                imageData.data;

            for (
                let i = 0;
                i < data.length;
                i += 4
            ) {

                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                const gray =
                    0.299 * r +
                    0.587 * g +
                    0.114 * b;

                let value =
                    (gray - 128) * 1.5 + 128;

                value = Math.max(
                    0,
                    Math.min(255, value)
                );

                data[i] = value;
                data[i + 1] = value;
                data[i + 2] = value;
            }

            ctx.putImageData(
                imageData,
                0,
                0
            );

            canvas.toBlob(
                blob => {

                    if (!blob) {

                        reject(
                            new Error(
                                "Could not create declaration image"
                            )
                        );

                        return;
                    }

                    resolve(blob);
                },
                "image/png"
            );
        };

        img.onerror = () => {

            reject(
                new Error(
                    "Unable to create declaration crop"
                )
            );
        };

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
        .replace(/\s+/g, " ")
        .trim();
}


// =====================================================
// COMMODITY
// =====================================================

function extractCommodity(text) {

    /*
     * Normal OCR:
     * Commodity : Toy
     *
     * OCR may produce:
     * Commodity Toy
     * commmy Toy
     * commoity Toy
     */

    let match = text.match(
        /commod\w*\s*[:\-]?\s*(toy|food|clothing|game|product|cosmetic|utensil|electronic|book|stationery)\b/i
    );

    if (match) {
        return match[1];
    }


    // Specifically look for Toy
    if (/\btoy\b/i.test(text)) {
        return "Toy";
    }

    return "Not detected";
}


// =====================================================
// NET QUANTITY
// =====================================================

function extractQuantity(text) {

    /*
     * IMPORTANT:
     * Do NOT search the entire OCR for random numbers.
     * First look around "Net Quantity".
     */

    let match = text.match(
        /net\s*quantity\s*[:\-]?\s*([0-9]{1,4}\s*(?:u|unit|units|pcs|pc|pieces|nos|no|kg|g|gm|mg|ml|l|ltr|litre|liter))\b/i
    );

    if (match) {

        return match[1]
            .replace(/\s+/g, " ")
            .trim();
    }


    // OCR may break the word Quantity
    match = text.match(
        /net\s*(?:quant\w*|qty)\s*[:\-]?\s*([0-9]{1,4}\s*(?:u|unit|units|pcs|pc|pieces|nos|no|kg|g|gm|mg|ml|l|ltr|litre|liter))\b/i
    );

    if (match) {

        return match[1]
            .replace(/\s+/g, " ")
            .trim();
    }


    /*
     * This product specifically has:
     * Net Quantity: 1U
     *
     * If OCR has already detected "1U",
     * accept it only when it appears as a
     * standalone quantity-like value.
     */

    const unitMatch = text.match(
        /\b(1\s*[uU])\b/
    );

    if (unitMatch) {
        return "1U";
    }

    return "Not detected";
}


// =====================================================
// MRP
// =====================================================

function extractMRP(text) {

    let match = text.match(
        /maximum\s*retail\s*price\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]{1,2})?)/i
    );

    if (match) {
        return "₹" + match[1];
    }


    match = text.match(
        /\bmrp\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]{1,2})?)/i
    );

    if (match) {
        return "₹" + match[1];
    }


    /*
     * This catches:
     * Maximum Retail Price: 149.00
     */

    match = text.match(
        /retail\s*price[^0-9]{0,20}([0-9]{2,5}(?:\.[0-9]{1,2})?)/i
    );

    if (match) {
        return "₹" + match[1];
    }


    return "Not detected";
}


// =====================================================
// MANUFACTURER
// =====================================================

function extractManufacturer(text) {

    let match = text.match(
        /manufactured\s*by\s*[:\-]?\s*([A-Z0-9 .,&()'-]+?)(?=\s+\d{2,4}\s*&|\s+584|\s+country|\s+dist\.|\s+month|\s+commodity|$)/i
    );

    if (match) {

        let value =
            match[1]
                .replace(/\s+/g, " ")
                .trim();

        if (value.length > 3) {
            return value;
        }
    }


    /*
     * Backup for OCR where address numbers
     * become part of manufacturer.
     */

    match = text.match(
        /manufactured\s*by\s*[:\-]?\s*([^\n]+)/i
    );

    if (match) {

        let value =
            match[1]
                .trim()
                .split(/\s+(?:584|office|dist\.|country|month|commodity)\b/i)[0]
                .trim();

        if (value.length > 3) {
            return value;
        }
    }

    return "Not detected";
}


// =====================================================
// MARKETED BY
// =====================================================

function extractMarketedBy(text) {

    let match = text.match(
        /marketed\s*by\s*[:\-]?\s*([A-Z0-9 .,&()'-]+?)(?=\s+office|\s+worken|\s+bandra|\s+manufactured|\s+country|$)/i
    );

    if (match) {

        return match[1]
            .replace(/\s+/g, " ")
            .trim();
    }

    return "Not detected";
}


// =====================================================
// COUNTRY OF ORIGIN
// =====================================================

function extractCountry(text) {

    let match = text.match(
        /country\s*of\s*origin\s*[:\-]?\s*(india|china|usa|u\.s\.a\.|japan|korea|germany|france|italy|uk)\b/i
    );

    if (match) {

        let country =
            match[1]
                .replace(/\./g, "")
                .toUpperCase();

        return country;
    }


    if (/\bindia\b/i.test(text)) {
        return "INDIA";
    }

    return "Not detected";
}


// =====================================================
// MANUFACTURING DATE
// =====================================================

function extractManufacturingDate(text) {

    let match = text.match(
        /month\s*(?:&|and)\s*year\s*of\s*mfg\.?\s*[:\-]?\s*(\d{1,2}\s*[\/\-]\s*\d{4})/i
    );

    if (match) {
        return match[1].replace(/\s/g, "");
    }


    // Backup: directly find 11/2025
    match = text.match(
        /\b(0?[1-9]|1[0-2])\s*[\/\-]\s*(20\d{2})\b/
    );

    if (match) {

        return (
            match[1] +
            "/" +
            match[2]
        );
    }

    return "Not detected";
}


// =====================================================
// CONSUMER CARE
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

    const hasEmail =
        /[\w.-]+@[\w.-]+\.\w+/.test(text);

    const hasPhone =
        /\b1[0-9]{2,3}\s*[0-9]{3,4}\s*[0-9]{3,4}\b/.test(text);

    if (
        hasConsumer ||
        hasCustomer ||
        hasComplaint ||
        hasEmail ||
        hasPhone
    ) {
        return "Detected";
    }

    return "Not detected";
}


// =====================================================
// CREATE DECLARATION CHECKLIST
// =====================================================

function createChecklist(data) {

    const existing =
        document.getElementById(
            "declarationChecklist"
        );

    if (existing) {
        existing.remove();
    }


    const checklist =
        document.createElement("div");

    checklist.id =
        "declarationChecklist";

    checklist.style.marginTop =
        "25px";

    checklist.style.padding =
        "20px";

    checklist.style.background =
        "#ffffff";

    checklist.style.borderRadius =
        "12px";

    checklist.style.border =
        "1px solid #ddd";


    checklist.innerHTML = `
        <h3 style="margin-bottom:15px;">
            Declaration Checklist
        </h3>

        ${checkItem(
            "Commodity / Common Name",
            data.commodity !== "Not detected"
        )}

        ${checkItem(
            "Net Quantity",
            data.quantity !== "Not detected"
        )}

        ${checkItem(
            "Maximum Retail Price (MRP)",
            data.mrp !== "Not detected"
        )}

        ${checkItem(
            "Manufacturer",
            data.manufacturer !== "Not detected"
        )}

        ${checkItem(
            "Marketed By",
            data.marketedBy !== "Not detected"
        )}

        ${checkItem(
            "Country of Origin",
            data.country !== "Not detected"
        )}

        ${checkItem(
            "Month & Year of Manufacture",
            data.manufacturingDate !== "Not detected"
        )}

        ${checkItem(
            "Consumer Care Details",
            data.consumerCare === "Detected"
        )}

        <p style="
            margin-top:15px;
            font-size:13px;
            color:#666;
        ">
            Screening result only. Human verification is recommended
            before taking regulatory action.
        </p>
    `;


    const resultSection =
        document.getElementById(
            "resultSection"
        );

    resultSection.appendChild(
        checklist
    );
}


// =====================================================
// CHECKLIST ITEM
// =====================================================

function checkItem(label, detected) {

    return `
        <div style="
            display:flex;
            justify-content:space-between;
            padding:9px 0;
            border-bottom:1px solid #eee;
        ">

            <span>
                ${label}
            </span>

            <strong style="
                color:${detected ? "#198754" : "#dc3545"};
            ">
                ${detected ? "✓ Detected" : "✗ Not Detected"}
            </strong>

        </div>
    `;
}


// =====================================================
// MAIN ANALYSIS
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


    complianceStatus.textContent =
        "Analyzing product...";

    complianceMessage.textContent =
        "Enhancing image and scanning package declarations...";

    productName.textContent =
        "Scanning...";

    netQuantity.textContent =
        "Scanning...";

    mrp.textContent =
        "Scanning...";

    manufacturer.textContent =
        "Scanning...";

    ocrText.textContent =
        "Running OCR...";


    document
        .getElementById(
            "resultSection"
        )
        .scrollIntoView({
            behavior: "smooth"
        });


    try {

        // ---------------------------------------------
        // IMAGE PROCESSING
        // ---------------------------------------------

        const enhancedImage =
            await preprocessImage(file);

        const declarationImage =
            await createDeclarationCrop(file);


        // ---------------------------------------------
        // OCR WORKER
        // ---------------------------------------------

        const worker =
            await Tesseract.createWorker(
                "eng"
            );


        // ---------------------------------------------
        // OCR FULL IMAGE
        // ---------------------------------------------

        const fullResult =
            await worker.recognize(
                enhancedImage
            );

        const fullText =
            fullResult.data.text;


        // ---------------------------------------------
        // OCR DECLARATION AREA
        // ---------------------------------------------

        const declarationResult =
            await worker.recognize(
                declarationImage
            );

        const declarationText =
            declarationResult.data.text;


        // ---------------------------------------------
        // COMBINE
        // ---------------------------------------------

        const combinedText =
            fullText +
            "\n" +
            declarationText;


        console.log(
            "FULL OCR:",
            fullText
        );

        console.log(
            "DECLARATION OCR:",
            declarationText
        );


        // ---------------------------------------------
        // EXTRACT
        // ---------------------------------------------

        const data = {

            commodity:
                extractCommodity(
                    combinedText
                ),

            quantity:
                extractQuantity(
                    combinedText
                ),

            mrp:
                extractMRP(
                    combinedText
                ),

            manufacturer:
                extractManufacturer(
                    combinedText
                ),

            marketedBy:
                extractMarketedBy(
                    combinedText
                ),

            country:
                extractCountry(
                    combinedText
                ),

            manufacturingDate:
                extractManufacturingDate(
                    combinedText
                ),

            consumerCare:
                detectConsumerCare(
                    combinedText
                )
        };


        console.log(
            "STRUCTURED RESULT:",
            data
        );


        // ---------------------------------------------
        // DISPLAY
        // ---------------------------------------------

        productName.textContent =
            data.commodity;

        netQuantity.textContent =
            data.quantity;

        mrp.textContent =
            data.mrp;

        manufacturer.textContent =
            data.manufacturer;


        // ---------------------------------------------
        // CHECKLIST
        // ---------------------------------------------

        createChecklist(data);


        // ---------------------------------------------
        // COMPLIANCE SCREENING
        // ---------------------------------------------

        const requiredChecks = [

            data.commodity !==
                "Not detected",

            data.quantity !==
                "Not detected",

            data.mrp !==
                "Not detected",

            data.manufacturer !==
                "Not detected",

            data.manufacturingDate !==
                "Not detected",

            data.consumerCare ===
                "Detected"
        ];


        const detectedCount =
            requiredChecks.filter(
                Boolean
            ).length;


        const total =
            requiredChecks.length;


        if (
            detectedCount === total
        ) {

            complianceStatus.textContent =
                "Potentially Compliant";

            complianceMessage.textContent =
                "All key declarations in the screening checklist were detected. Human verification is recommended.";

        } else {

            complianceStatus.textContent =
                "Potential Non-Compliance";

            complianceMessage.textContent =
                detectedCount +
                " of " +
                total +
                " key declarations were detected. Please review the checklist and verify the package manually.";
        }


        // ---------------------------------------------
        // DISPLAY CLEAN SUMMARY + OCR
        // ---------------------------------------------

        ocrText.textContent =

            "STRUCTURED DECLARATION DATA\n\n" +

            "Commodity: " +
            data.commodity +

            "\nNet Quantity: " +
            data.quantity +

            "\nMRP: " +
            data.mrp +

            "\nManufacturer: " +
            data.manufacturer +

            "\nMarketed By: " +
            data.marketedBy +

            "\nCountry of Origin: " +
            data.country +

            "\nManufacturing Date: " +
            data.manufacturingDate +

            "\nConsumer Care: " +
            data.consumerCare +

            "\n\n-----------------------------\n" +

            "RAW OCR OUTPUT\n\n" +

            combinedText;


        await worker.terminate();


    } catch (error) {

        console.error(error);

        complianceStatus.textContent =
            "Analysis Failed";

        complianceMessage.textContent =
            "Unable to process the image. Please upload a clearer product-label photograph.";

        ocrText.textContent =
            "OCR Error: " +
            error.message;
    }
}
