function analyzeProduct() {
    const imageInput = document.getElementById("productImage");

    if (imageInput.files.length === 0) {
        alert("Please upload a product image first.");
        return;
    }

    alert("Product image received! OCR analysis will be added next.");
}
