'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateBusiness } from '@/hooks/use-business';
import { CEBU_CITIES, POSTAL_CODE_MAP, lookupBarangay } from '@/lib/cebu-locations';
import { sanitizeName, sanitizeOptional } from '@/lib/sanitize';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const VENUE_TYPES = [
  'Bar',
  'Restaurant',
  'Cafe',
  'Milk Tea Shop',
  'Food Stall',
  'Bakery',
  'Fast Food',
  'Night Club',
  'Pub',
  'Other',
];

type AddressForm = {
  street: string;
  barangay: string;
  city: string;
  province: string;
  postalCode: string;
};

function composeLocation(addr: AddressForm): string {
  return [
    sanitizeName(addr.street),
    sanitizeName(addr.barangay),
    addr.city,
    addr.province,
    addr.postalCode,
  ]
    .filter(Boolean)
    .join(', ');
}

export default function OnboardingPage() {
  const router = useRouter();
  const createBusiness = useCreateBusiness();
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [address, setAddress] = useState<AddressForm>({
    street: '',
    barangay: '',
    city: '',
    province: '',
    postalCode: '',
  });
  const [error, setError] = useState<string | null>(null);

  function handleBarangayChange(value: string) {
    const match = lookupBarangay(value);
    setAddress((prev) => ({
      ...prev,
      barangay: value,
      ...(match && {
        city: match.city,
        province: 'Cebu',
        postalCode: match.postalCode,
      }),
    }));
  }

  function handleCityChange(value: string) {
    setAddress((prev) => ({
      ...prev,
      city: value,
      province: value ? 'Cebu' : '',
      postalCode: POSTAL_CODE_MAP[value] ?? '',
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createBusiness.mutateAsync({
        name: sanitizeName(name),
        type: type || undefined,
        location: sanitizeOptional(composeLocation(address)),
      });
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  const canSubmit = name.trim().length > 0 && !createBusiness.isPending;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-sm font-medium text-primary">Prizo</p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            Set up your venue
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Just the basics — you can update these later.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Venue name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Venue name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              required
              autoFocus
              placeholder="e.g. The Rusty Barrel"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {VENUE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Address */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Address</p>

            {/* Row: Street */}
            <div className="space-y-1.5">
              <Label htmlFor="street" className="text-xs text-muted-foreground">
                Street
              </Label>
              <Input
                id="street"
                placeholder="e.g. 12 Mango Ave"
                value={address.street}
                onChange={(e) => setAddress((p) => ({ ...p, street: e.target.value }))}
              />
            </div>

            {/* Row: Barangay | City/Municipality */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="barangay" className="text-xs text-muted-foreground">
                  Barangay
                </Label>
                <Input
                  id="barangay"
                  placeholder="e.g. Lahug"
                  value={address.barangay}
                  onChange={(e) => handleBarangayChange(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="city" className="text-xs text-muted-foreground">
                  City / Municipality
                </Label>
                <Select value={address.city} onValueChange={handleCityChange}>
                  <SelectTrigger id="city">
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    {CEBU_CITIES.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row: Province | Postal Code */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="province" className="text-xs text-muted-foreground">
                  Province
                </Label>
                <Input
                  id="province"
                  value={address.province}
                  disabled
                  placeholder="Auto-filled"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="postalCode" className="text-xs text-muted-foreground">
                  Postal code
                </Label>
                <Input
                  id="postalCode"
                  value={address.postalCode}
                  disabled
                  placeholder="Auto-filled"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={!canSubmit} className="w-full">
            {createBusiness.isPending ? 'Creating...' : 'Create venue'}
          </Button>
        </form>
      </div>
    </div>
  );
}
