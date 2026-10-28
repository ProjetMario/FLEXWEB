import path from 'node:path';
const snapshotErrors=new Set(['CMS_CONNECTION_FAILED','CMS_INVALID_JSON','CMS_RESPONSE_TOO_LARGE','CMS_ENTRY_TOO_LARGE','MISSING_SCOPED_CMS_TOKEN','INVALID_CMS_PAGE','INVALID_CMS_SCANNED_COUNT','DUPLICATE_OR_MIXED_CMS_PAGE','CMS_PAGINATION_LIMIT','CMS_REPEATED_CURSOR','ARCHIVE_CONTENT_MISMATCH','ARCHIVE_STATUS_UNAVAILABLE','SNAPSHOT_SOURCE_MISMATCH','SNAPSHOT_BASELINE_OR_PRICES_MISMATCH','SOURCE_RENDER_CHANGED','SNAPSHOT_OPERATION_FAILED']);
export function commandFailureCode(file,args,error){
 const fallback=`COMMAND_FAILED_${path.basename(file).replace(/[^a-z0-9]/gi,'_').toUpperCase()}`;
 if(args[0]!=='scripts/cms/snapshot.mjs')return fallback;
 const stage=['pull','apply','validate','report'].includes(args[1])?args[1].toUpperCase():'OPERATION';
 const detail=typeof error?.stderr==='string'?error.stderr.trim():'';
 return snapshotErrors.has(detail)||/^CMS_HTTP_[0-9]{3}$/.test(detail)?`SNAPSHOT_${stage}_${detail}`:`SNAPSHOT_${stage}_FAILED`;
}
