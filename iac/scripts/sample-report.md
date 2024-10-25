# Deployment Report

## Summary
| Stack         | Deployment Status | Total Time Taken | Failed Subprojects    |
|---------------|-------------------|------------------|-----------------------|
| Compass-Dev   | ✅ Success        | 15m 30s         | None                  |

---

## Detailed Deployment Breakdown

### Compass-Dev
**Status**: ✅ Success  
**Env type:**: test  
**Deployment type:**: auto  
**Total Time**: 15m 30s

| Subproject | Status  | Version    | Time Taken |
|------------|---------|------------|------------|
| Auth       | ✅ Success | v1.2.0    | 5m 15s    |
| Frontend   | ✅ Success | v2.1.3    | 6m 10s    |
| Backend    | ✅ Success | v3.0.1    | 4m 5s     |

---

## Key Insights
- **Deployment Success Rate**: 2/3 environments successfully deployed all subprojects.
- **Average Deployment Time**: ~16m per environment.
- **Failures**:
    - Compass-Dev: Auth failed due to a timeout issue.

