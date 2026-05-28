import { isArray } from '../isArray';

export function isEmpty(value) {
    if (value === undefined || value === null || value === '') {
        return true;
    }
    if (isArray(value)) {
        return Boolean(value.length === 0);
    }
    if (typeof value === 'object') {
        if (value instanceof Date) {
            return isNaN(value.getTime());
        }
        if (value instanceof Blob) {
            return false;
        }
        return value !== null
            ? Boolean(Object.keys(value).length === 0)
            : false;
    }

    return false;
}
