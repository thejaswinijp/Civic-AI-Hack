// ReportIssue/index.js
const { BlobServiceClient } = require('@azure/storage-blob');
const { TextAnalyticsClient, AzureKeyCredential } = require('@azure/ai-text-analytics');

module.exports = async function (context, req) {
  const issue = req.body.issue;
  const location = req.body.location;
  const image = req.files.image;

  // Upload image to Azure Blob Storage
  const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient('images');
  const blobName = issue-${Date.now()}.jpg;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(image.data, { blobHTTPHeaders: { blobContentType: image.mimetype } });

  // Use Azure Cognitive Services for summarization
  const textAnalyticsClient = new TextAnalyticsClient(
    process.env.AZURE_TEXT_ANALYTICS_ENDPOINT,
    new AzureKeyCredential(process.env.AZURE_TEXT_ANALYTICS_KEY)
  );
  const summaryResult = await textAnalyticsClient.extractKeyPhrases([issue]);

  // Save issue to Azure SQL Database
  const summary = summaryResult[0].keyPhrases.join(', ');
  const sql = require('mssql');
  await sql.connect(process.env.AZURE_SQL_CONNECTION_STRING);
  await sql.query`INSERT INTO Issues (Description, Location, ImageUrl, Summary) VALUES (${issue}, ${location}, ${blockBlobClient.url}, ${summary})`;

  context.res = {
    status: 200,
    body: { summary }
  };
};