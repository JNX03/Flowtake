use crate::error::{AppError, AppResult};

fn is_canonical_uuid(value: &str) -> bool {
    uuid::Uuid::parse_str(value)
        .map(|parsed| parsed.hyphenated().to_string() == value)
        .unwrap_or(false)
}

pub fn validate_project_id(project_id: &str) -> AppResult<()> {
    if is_canonical_uuid(project_id) {
        Ok(())
    } else {
        Err(AppError::General("Invalid project id".to_string()))
    }
}

pub fn validate_render_id(render_id: &str) -> AppResult<()> {
    match render_id.strip_prefix("render-") {
        Some(id) if is_canonical_uuid(id) => Ok(()),
        _ => Err(AppError::General("Invalid render id".to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::{validate_project_id, validate_render_id};

    const UUID: &str = "123e4567-e89b-42d3-a456-426614174000";

    #[test]
    fn project_ids_require_exact_canonical_uuids() {
        assert!(validate_project_id(UUID).is_ok());
        for invalid in [
            "..",
            "../..",
            "..\\..",
            "/tmp/project",
            "C:\\temp\\project",
            "%2e%2e%2f",
            "123E4567-E89B-42D3-A456-426614174000",
            "{123e4567-e89b-42d3-a456-426614174000}",
            "123e4567e89b42d3a456426614174000",
        ] {
            assert!(validate_project_id(invalid).is_err(), "accepted {invalid}");
        }
    }

    #[test]
    fn render_ids_require_render_prefix_and_canonical_uuid() {
        assert!(validate_render_id(&format!("render-{UUID}")).is_ok());
        for invalid in [
            UUID,
            "render-..",
            "render-../outside",
            "render-..\\outside",
            "../render-123e4567-e89b-42d3-a456-426614174000",
            "render-123E4567-E89B-42D3-A456-426614174000",
        ] {
            assert!(validate_render_id(invalid).is_err(), "accepted {invalid}");
        }
    }
}
