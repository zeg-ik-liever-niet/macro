//! Adapters preserving the established permanent document cleanup behavior.

use super::super::domain::{
    models::DocumentError,
    purge::{DocumentPurgeQueue, DocumentPurgeRepository},
};
use std::sync::Arc;

/// Existing document deletion queries behind the owning document boundary.
pub struct LegacyDocumentPurgeRepository {
    pool: sqlx::PgPool,
}

impl LegacyDocumentPurgeRepository {
    /// Compose from the application's database pool.
    pub fn new(pool: sqlx::PgPool) -> Self {
        Self { pool }
    }
}

impl DocumentPurgeRepository for LegacyDocumentPurgeRepository {
    async fn purge_rows(&self, document_id: &str) -> Result<(), DocumentError> {
        macro_db_client::document::delete_document(&self.pool, document_id)
            .await
            .map_err(DocumentError::Internal)?;
        comms_db_client::entity_mentions::delete_entity_mentions_by_source(
            &self.pool,
            vec![document_id.to_owned()],
        )
        .await
        .inspect_err(|error| {
            tracing::error!(?error, %document_id, "unable to delete outgoing document mentions");
        })
        .ok();
        Ok(())
    }
}

/// Adapter for the application's existing document deletion queue.
pub struct SqsDocumentPurgeQueue {
    sqs: Arc<sqs_client::SQS>,
}

impl SqsDocumentPurgeQueue {
    /// Compose from the application's configured queue client.
    pub fn new(sqs: Arc<sqs_client::SQS>) -> Self {
        Self { sqs }
    }
}

impl DocumentPurgeQueue for SqsDocumentPurgeQueue {
    async fn enqueue(&self, document_id: String) -> Result<(), DocumentError> {
        self.sqs
            .bulk_enqueue_document_delete(vec![document_id])
            .await
            .map_err(DocumentError::Internal)
    }
}
