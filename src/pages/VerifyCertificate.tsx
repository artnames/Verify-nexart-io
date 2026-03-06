import { useParams, Navigate } from "react-router-dom";

/**
 * /c/:certificateHash → redirects to /audit/:hash
 * which already handles certificate hash lookup and verification display.
 */
export default function VerifyCertificate() {
  const { certificateHash } = useParams<{ certificateHash: string }>();

  if (!certificateHash) {
    return <Navigate to="/" replace />;
  }

  return <Navigate to={`/audit/${certificateHash}`} replace />;
}
