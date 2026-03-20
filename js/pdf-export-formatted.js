function exportSitesToPDF() {
    // Create a new PDF document
    const doc = new jsPDF();

    // Set title and date
    doc.setFontSize(18);
    doc.text('Relatório de Sites CFTV', 14, 22);
    doc.setFontSize(12);
    doc.text('Date: 2026-03-20', 14, 30);
    doc.text('Operator: CesarYamada40', 14, 36);

    // Define table columns
    const columns = ['Sigla', 'Conta', 'Regional', 'Status', 'Câmeras', 'Alarme', 'CFTV'];

    // Sample data (replace with actual data retrieval)
    const data = [
        // Example rows
        ['SIG1', '12345', 'Region A', 'OK', '5', 'Yes', 'CFTV1'],
        ['SIG2', '67890', 'Region B', 'PARCIAL', '3', 'No', 'CFTV2'],
        ['SIG3', '23456', 'Region C', 'DESCONECTADO', '0', 'No', 'CFTV3'],
    ];

    // Format rows based on status
    data.forEach((row, index) => {
        let statusColor;
        switch(row[3]) {
            case 'OK':
                statusColor = 'rgba(0, 255, 0, 0.5)'; // Green
                break;
            case 'PARCIAL':
                statusColor = 'rgba(255, 255, 0, 0.5)'; // Yellow
                break;
            case 'DESCONECTADO':
                statusColor = 'rgba(255, 0, 0, 0.5)'; // Red
                break;
            default:
                statusColor = 'rgba(255, 255, 255, 0.5)'; // Default
        }
        doc.setFillColor(...statusColor.replace(/rgba\((\d+), (\d+), (\d+), (\d+)\)/.exec(statusColor).slice(1, 5)).map(Number));
        doc.rect(14, 50 + index * 10, 180, 10, 'F'); // Draw background
        doc.setTextColor(0); // Reset text color
        doc.text(row, 14, 50 + index * 10 + 7);
    });

    // Save the PDF
    doc.save('Relatório_de_Sites_CFTV.pdf');
}