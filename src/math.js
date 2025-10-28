class Fraction {
	constructor(numerator, denominator = 1) {
		if (denominator === 0) {
			throw new Error("Denominator cannot be zero");
		}

		if (
			isNaN(numerator) ||
			isNaN(denominator) ||
			numerator === null ||
			denominator === null
		) {
			throw new Error("invalid argument");
		}

		const g = gcd(Math.abs(numerator), Math.abs(denominator));
		this.num = numerator / g;
		this.den = denominator / g;

		// Keep denominator positive
		if (this.den < 0) {
			this.num = -this.num;
			this.den = -this.den;
		}
	}

	clone() {
		return new Fraction(this.num, this.den);
	}

	multiply(n) {
		if (typeof n === "number") {
			return new Fraction(this.num * n, this.den);
		}
		return new Fraction(this.num * n.num, this.den * n.den);
	}

	divide(n) {
		if (typeof n === "number") {
			return new Fraction(this.num, this.den * n);
		}
		return new Fraction(this.num * n.den, this.den * n.num);
	}

	add(n) {
		if (typeof n === "number") {
			return new Fraction(this.num + n * this.den, this.den);
		}
		return new Fraction(this.num * n.den + n.num * this.den, this.den * n.den);
	}

	subtract(n) {
		if (typeof n === "number") {
			return new Fraction(this.num - n * this.den, this.den);
		}
		return new Fraction(this.num * n.den - n.num * this.den, this.den * n.den);
	}

	compare(other) {
		// Returns -1 if this < other, 0 if equal, 1 if this > other
		const diff =
			typeof n === "number"
				? this.num - other * this.den
				: this.num * other.den - other.num * this.den;
		return diff < 0 ? -1 : diff > 0 ? 1 : 0;
	}

	equals(other) {
		return this.num === other.num && this.den === other.den;
	}

	isGreaterThan(other) {
		return this.compare(other) > 0;
	}

	isLessThan(other) {
		return this.compare(other) < 0;
	}

	toString() {
		return this.den === 1 ? `${this.num}` : `${this.num}/${this.den}`;
	}
	toNumber() {
		return this.num / this.den;
	}
}

function gcd(a, b) {
	return b === 0 ? a : gcd(b, a % b);
}

// function lcm(a, b) {
//   return Math.abs(a * b) / gcd(a, b);
// }
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		// lcm,
		// gcd,
		Fraction,
	};
}
