function exportDataToPDF(data) {
    // Create a new PDF document
    const doc = new jsPDF();

    // Set title
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text('Site Data Export', 14, 22);

    // Set some colors
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(12);

    // Add data to PDF
    let y = 30;
    data.forEach((site, index) => {
        doc.setTextColor(40, 40, 40);
        doc.text(`Site ${index + 1}: ${site.name}`, 14, y);
        doc.text(`URL: ${site.url}`, 14, y + 5);
        y += 15;
    });

    // Save the PDF
    doc.save('site_data.pdf');
}